"""
PHANTOM — AnomalyAssessment Pydantic Model (single-agent output)
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class InvestigationStatus(str, Enum):
    ANOMALY_SUPPORTED = "anomaly_supported"
    ANOMALY_PARTIALLY_SUPPORTED = "anomaly_partially_supported"
    ANOMALY_INCONCLUSIVE = "anomaly_inconclusive"
    ANOMALY_UNSUPPORTED = "anomaly_unsupported"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class AnomalyAssessment(BaseModel):
    """
    Structured output of the single AI investigation agent.
    Confidence reflects evidence strength, NOT probability of criminal activity.
    """

    anomaly_detected: bool = Field(
        description="Whether the investigation found evidence supporting the anomaly"
    )
    anomaly_category: str = Field(
        description="Category of anomaly being assessed"
    )
    severity: str = Field(description="Assessed severity level")

    factual_observations: List[str] = Field(
        description="Factual observations derived from dataset records (with record references)"
    )
    supporting_evidence: List[str] = Field(
        description="Evidence that supports the anomaly (with evidence IDs)"
    )
    contradictory_evidence: List[str] = Field(
        default_factory=list,
        description="Evidence that contradicts or explains the anomaly",
    )
    possible_explanations: List[str] = Field(
        default_factory=list,
        description="Plausible alternative explanations (e.g. data entry errors, sync delays)",
    )
    missing_information: List[str] = Field(
        default_factory=list,
        description="Information that would help resolve the case but is unavailable",
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Evidence strength [0.0–1.0]. Not a probability of fraud.",
    )

    investigation_status: InvestigationStatus = Field(
        description="Overall investigation conclusion"
    )

    assessment_summary: str = Field(
        description="Evidence-driven narrative summary (1–3 paragraphs). "
                    "Must reference actual record IDs. Must not make legal determinations."
    )

    recommended_human_review_actions: List[str] = Field(
        default_factory=list,
        description="Specific actions recommended for human investigators",
    )

    limitations: List[str] = Field(
        default_factory=list,
        description="Explicit limitations of this automated assessment",
    )

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        return round(v, 4)

    class Config:
        use_enum_values = True
