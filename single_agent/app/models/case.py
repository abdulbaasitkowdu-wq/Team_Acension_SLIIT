"""
PHANTOM — InvestigationCase Pydantic Model
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class AnomalyCategory(str, Enum):
    DUPLICATE_IDENTIFIER = "duplicate_identifier"
    QUANTITY_DISCREPANCY = "quantity_discrepancy"
    RELATIONAL_INCONSISTENCY = "relational_inconsistency"
    CHRONOLOGICAL_ANOMALY = "chronological_anomaly"
    DISTRIBUTION_CUSTODY = "distribution_custody"
    TEMPERATURE_EXCURSION = "temperature_excursion"
    AUTHENTICATION_FAILURE = "authentication_failure"
    UNAUTHORIZED_ENTITY = "unauthorized_entity"
    COUNTERFEIT_INDICATOR = "counterfeit_indicator"
    DIVERSION = "diversion"
    TAMPERING = "tampering"
    MASKED_TRANSACTION = "masked_transaction"
    COMPOSITE = "composite"


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InvestigationCase(BaseModel):
    """Structured investigation case created from a detected anomaly."""

    case_id: str = Field(
        default_factory=lambda: f"CASE-{uuid4().hex[:8].upper()}",
        description="Unique case identifier",
    )
    anomaly_category: AnomalyCategory = Field(
        description="Category of the detected anomaly"
    )
    severity: SeverityLevel = Field(description="Assessed severity of the anomaly")
    description: str = Field(description="Human-readable description of the anomaly")

    # Related identifiers — from actual dataset
    transaction_ids: List[str] = Field(
        default_factory=list,
        description="Transaction identifiers (batch_id+event_type+batch_tx_index composites)",
    )
    batch_ids: List[str] = Field(
        default_factory=list, description="Batch IDs involved"
    )
    medicine_ids: List[str] = Field(
        default_factory=list, description="Medicine IDs involved"
    )
    entity_ids: List[str] = Field(
        default_factory=list,
        description="Entity IDs involved (manufacturer_id or entity_id)",
    )

    # Detection metadata
    detection_rule: str = Field(description="Name of the rule that created this case")
    detection_explanation: str = Field(
        description="Detailed explanation of why the rule fired"
    )
    evidence_references: List[str] = Field(
        default_factory=list,
        description="Source dataset record references (table:row_key)",
    )

    # Ground truth (preserved from dataset — not agent-generated)
    ground_truth_label: Optional[bool] = Field(
        default=None,
        description="Original dataset fraud label (is_fraud_ground_truth), if available",
    )
    ground_truth_fraud_type: Optional[str] = Field(
        default=None,
        description="Original dataset fraud_type label, if available",
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When this case was created",
    )

    @field_validator("batch_ids", "medicine_ids", "entity_ids", "transaction_ids", mode="before")
    @classmethod
    def deduplicate_ids(cls, v: list) -> list:
        seen = set()
        result = []
        for item in v:
            if item not in seen:
                seen.add(item)
                result.append(item)
        return result

    class Config:
        use_enum_values = True
        json_encoders = {datetime: lambda v: v.isoformat()}
