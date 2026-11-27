"""
PHANTOM — InvestigationReport Pydantic Model (final output)
JSON-serializable, React dashboard compatible.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models.assessment import AnomalyAssessment, InvestigationStatus
from app.models.case import AnomalyCategory, InvestigationCase, SeverityLevel
from app.models.evidence import EvidenceItem
from app.models.metrics import EvaluationMetrics
from app.models.timeline import BatchTimeline


class ReportStatus(str, Enum):
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    PENDING = "pending"


class RelationalValidationSummary(BaseModel):
    total_checks: int = 0
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    details: List[Dict[str, Any]] = Field(default_factory=list)


class TimelineValidationSummary(BaseModel):
    total_batches_checked: int = 0
    valid_timelines: int = 0
    invalid_timelines: int = 0
    missing_events_count: int = 0
    chronological_violations: int = 0
    details: List[str] = Field(default_factory=list)


class InvestigationReport(BaseModel):
    """
    Final structured investigation report — JSON-serializable for React dashboard.
    All fields that are unavailable are explicitly null, never fabricated.
    """

    # Identity
    report_id: str = Field(
        default_factory=lambda: f"RPT-{uuid4().hex[:8].upper()}",
        description="Unique report identifier",
    )
    case_id: str = Field(description="Investigation case ID this report covers")
    investigation_status: ReportStatus = Field(description="Report generation status")
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Report generation timestamp (UTC)",
    )

    # Case details
    case_details: InvestigationCase = Field(description="Full investigation case")
    targeted_entities: List[str] = Field(
        default_factory=list,
        description="Entity IDs (or manufacturer IDs) targeted by this investigation",
    )
    batch_ids: List[str] = Field(default_factory=list)
    medicine_ids: List[str] = Field(default_factory=list)
    transaction_ids: List[str] = Field(default_factory=list)

    # Anomaly meta
    anomaly_category: AnomalyCategory = Field(description="Detected anomaly category")
    severity: SeverityLevel = Field(description="Anomaly severity")

    # Validation
    relational_validation_summary: RelationalValidationSummary = Field(
        default_factory=RelationalValidationSummary
    )
    chronological_timeline: Optional[BatchTimeline] = Field(
        default=None,
        description="Reconstructed batch timeline (None if unavailable)",
    )
    timeline_validation_summary: TimelineValidationSummary = Field(
        default_factory=TimelineValidationSummary
    )

    # Evidence log — ordered chronologically
    evidence_log: List[EvidenceItem] = Field(
        default_factory=list,
        description="All evidence collected during investigation",
    )

    # Agent assessment
    anomaly_assessment: Optional[AnomalyAssessment] = Field(
        default=None,
        description="Single-agent investigation assessment (None if investigation failed)",
    )
    supporting_evidence: List[str] = Field(
        default_factory=list,
        description="Evidence IDs that support the anomaly",
    )
    contradictory_evidence: List[str] = Field(
        default_factory=list,
        description="Evidence IDs that contradict the anomaly",
    )
    missing_information: List[str] = Field(
        default_factory=list,
        description="Information gaps identified during investigation",
    )

    # Final evaluation
    final_evaluation_result: Optional[str] = Field(
        default=None,
        description="Evidence-driven narrative evaluation. "
                    "No legal or executive decisions. References actual record IDs.",
    )
    investigation_status_detail: Optional[InvestigationStatus] = Field(
        default=None,
        description="Detailed investigation conclusion category",
    )
    recommended_human_review_actions: List[str] = Field(
        default_factory=list,
        description="Specific recommended actions for human investigators",
    )

    # Metrics
    evaluation_metrics: Optional[EvaluationMetrics] = Field(
        default=None,
        description="Evaluation metrics (populated at run level, not individual report level)",
    )

    # Limitations
    limitations: List[str] = Field(
        default_factory=list,
        description="Explicit limitations of this automated investigation",
    )

    # Processing
    processing_errors: List[str] = Field(
        default_factory=list,
        description="Non-fatal errors encountered during processing",
    )
    investigation_time_seconds: Optional[float] = Field(
        default=None, description="Seconds taken to investigate this case"
    )

    class Config:
        use_enum_values = True
        json_encoders = {datetime: lambda v: v.isoformat()}

    def to_dashboard_dict(self) -> Dict[str, Any]:
        """Return a JSON-serializable dict suitable for the React dashboard."""
        return self.model_dump(mode="json")
