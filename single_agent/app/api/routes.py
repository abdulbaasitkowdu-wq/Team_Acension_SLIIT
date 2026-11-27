"""
PHANTOM — FastAPI Routes
Provides REST endpoints for the React dashboard.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

from app.data_processing.dataset_loader import data_store
from app.graph.workflow import run_investigation
from app.graph.state import PhantomWorkflowState
from app.models.metrics import EvaluationMetrics
from app.models.report import InvestigationReport

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory store for investigation results (single-node MVP)
_investigation_state: Optional[PhantomWorkflowState] = None
_investigation_running = False


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health", tags=["System"])
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "system": "PHANTOM Single-Agent Investigation System",
        "dataset_loaded": data_store.is_loaded,
    }


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

@router.get("/dataset/summary", tags=["Dataset"])
def get_dataset_summary() -> Dict[str, Any]:
    """Return available datasets, row counts, and schema information."""
    if not data_store.is_loaded:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")
    return {
        "status": "loaded",
        "metadata": data_store.metadata,
    }


# ---------------------------------------------------------------------------
# Investigation
# ---------------------------------------------------------------------------

class InvestigationRunRequest(BaseModel):
    max_cases: int = 50


class InvestigationRunResponse(BaseModel):
    run_id: str
    status: str
    message: str


@router.post("/investigations/run", tags=["Investigation"])
def run_investigation_endpoint(
    request: InvestigationRunRequest,
    background_tasks: BackgroundTasks,
) -> InvestigationRunResponse:
    """Start the investigation workflow. Runs synchronously for MVP (single-node)."""
    global _investigation_state, _investigation_running

    if _investigation_running:
        raise HTTPException(status_code=409, detail="Investigation already in progress.")

    _investigation_running = True
    try:
        logger.info(f"Starting investigation run with max_cases={request.max_cases}")
        _investigation_state = run_investigation(max_cases=request.max_cases)
        return InvestigationRunResponse(
            run_id=_investigation_state.run_id,
            status="completed",
            message=(
                f"Investigation complete. {len(_investigation_state.investigation_cases)} cases investigated. "
                f"{len(_investigation_state.investigation_reports)} reports generated."
            ),
        )
    except Exception as e:
        logger.error(f"Investigation run failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Investigation failed: {str(e)}")
    finally:
        _investigation_running = False


@router.get("/investigations/cases", tags=["Investigation"])
def get_investigation_cases() -> List[Dict[str, Any]]:
    """Return all detected investigation cases."""
    if _investigation_state is None:
        raise HTTPException(status_code=404, detail="No investigation results available. Run /investigations/run first.")
    return [
        {
            "case_id": c.case_id,
            "anomaly_category": c.anomaly_category,
            "severity": c.severity,
            "description": c.description,
            "batch_ids": c.batch_ids,
            "medicine_ids": c.medicine_ids,
            "entity_ids": c.entity_ids,
            "detection_rule": c.detection_rule,
            "ground_truth_label": c.ground_truth_label,
            "ground_truth_fraud_type": c.ground_truth_fraud_type,
            "created_at": c.created_at.isoformat(),
        }
        for c in _investigation_state.investigation_cases
    ]


@router.get("/investigations/cases/{case_id}", tags=["Investigation"])
def get_case_detail(case_id: str) -> Dict[str, Any]:
    """Return an individual case and its investigation report."""
    if _investigation_state is None:
        raise HTTPException(status_code=404, detail="No investigation results available.")

    case = next(
        (c for c in _investigation_state.investigation_cases if c.case_id == case_id),
        None,
    )
    if case is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")

    report = next(
        (r for r in _investigation_state.investigation_reports if r.case_id == case_id),
        None,
    )
    assessment = _investigation_state.agent_assessments.get(case_id)

    return {
        "case": case.model_dump(mode="json"),
        "assessment": assessment.model_dump(mode="json") if assessment else None,
        "report": report.to_dashboard_dict() if report else None,
    }


@router.get("/investigations/metrics", tags=["Investigation"])
def get_evaluation_metrics() -> Dict[str, Any]:
    """Return evaluation metrics for the last investigation run."""
    if _investigation_state is None:
        raise HTTPException(status_code=404, detail="No investigation results available.")
    if _investigation_state.evaluation_metrics is None:
        return {"status": "no_metrics", "detail": "Metrics not yet calculated."}
    return _investigation_state.evaluation_metrics.model_dump(mode="json")


@router.get("/investigations/reports/{case_id}", tags=["Reports"])
def get_case_report(case_id: str) -> Dict[str, Any]:
    """Return the full structured investigation report for a case."""
    if _investigation_state is None:
        raise HTTPException(status_code=404, detail="No investigation results available.")

    report = next(
        (r for r in _investigation_state.investigation_reports if r.case_id == case_id),
        None,
    )
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report for case {case_id} not found.")

    return report.to_dashboard_dict()


@router.get("/investigations/status", tags=["Investigation"])
def get_investigation_status() -> Dict[str, Any]:
    """Return the current investigation run status."""
    if _investigation_state is None:
        return {"status": "idle", "message": "No investigation has been run."}

    return {
        "run_id": _investigation_state.run_id,
        "dataset_loaded": _investigation_state.dataset_loaded,
        "cases_created": _investigation_state.cases_created,
        "investigation_complete": _investigation_state.investigation_complete,
        "reports_generated": _investigation_state.reports_generated,
        "total_cases": len(_investigation_state.investigation_cases),
        "investigated_cases": len(_investigation_state.agent_assessments),
        "total_reports": len(_investigation_state.investigation_reports),
        "processing_errors": _investigation_state.processing_errors,
        "execution_time_seconds": _investigation_state.total_execution_time_seconds,
    }
