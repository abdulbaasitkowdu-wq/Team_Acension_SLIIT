"""
PHANTOM — LangGraph Workflow State
Strongly typed state container for the investigation workflow.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.assessment import AnomalyAssessment
from app.models.case import InvestigationCase
from app.models.metrics import EvaluationMetrics
from app.models.report import InvestigationReport
from app.models.timeline import BatchTimeline


class PhantomWorkflowState(BaseModel):
    """
    Full LangGraph workflow state for PHANTOM investigation.
    Transitions validated via Pydantic.
    """
    model_config = {"arbitrary_types_allowed": True}

    # -- Phase 1: Dataset Loading --
    dataset_metadata: Dict[str, Any] = Field(default_factory=dict)
    dataset_loaded: bool = False
    dataset_load_errors: List[str] = Field(default_factory=list)

    # -- Phase 2: Input Validation --
    schema_summary: Dict[str, Any] = Field(default_factory=dict)
    validation_results: Dict[str, Any] = Field(default_factory=dict)
    input_valid: bool = False
    validation_errors: List[str] = Field(default_factory=list)

    # -- Phase 3: Relational Validation --
    relational_validation_summary: Dict[str, Any] = Field(default_factory=dict)
    relational_validation_complete: bool = False

    # -- Phase 4: Timeline Building --
    batch_timelines: Dict[str, Any] = Field(default_factory=dict)  # batch_id -> dict
    timelines_built: bool = False

    # -- Phase 5: Anomaly Detection --
    detected_anomalies: List[InvestigationCase] = Field(default_factory=list)
    anomaly_detection_complete: bool = False

    # -- Phase 6: Case Creation --
    investigation_cases: List[InvestigationCase] = Field(default_factory=list)
    cases_created: bool = False

    # -- Phase 7: Evidence Retrieval --
    case_evidence: Dict[str, Any] = Field(default_factory=dict)  # case_id -> evidence dict
    evidence_retrieved: bool = False

    # -- Phase 8: Agent Investigation --
    agent_assessments: Dict[str, AnomalyAssessment] = Field(default_factory=dict)  # case_id -> assessment
    agent_usage_metadata: Dict[str, Any] = Field(default_factory=dict)  # case_id -> usage
    investigation_complete: bool = False
    investigation_errors: List[str] = Field(default_factory=list)

    # -- Phase 9: Result Validation --
    validated_assessments: Dict[str, bool] = Field(default_factory=dict)  # case_id -> valid
    result_validation_complete: bool = False

    # -- Phase 10: Evaluation Metrics --
    evaluation_metrics: Optional[EvaluationMetrics] = None
    metrics_calculated: bool = False

    # -- Phase 11: Final Reports --
    investigation_reports: List[InvestigationReport] = Field(default_factory=list)
    reports_generated: bool = False

    # -- Global execution tracking --
    processing_errors: List[str] = Field(default_factory=list)
    execution_start_time: Optional[datetime] = None
    execution_end_time: Optional[datetime] = None
    total_execution_time_seconds: Optional[float] = None

    # -- Configuration --
    max_cases: int = 50
    run_id: str = Field(
        default_factory=lambda: f"RUN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )

    def add_error(self, error: str) -> None:
        self.processing_errors.append(f"[{datetime.now(timezone.utc).isoformat()}] {error}")
