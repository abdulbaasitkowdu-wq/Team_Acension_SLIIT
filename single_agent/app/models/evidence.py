"""
PHANTOM — EvidenceItem Pydantic Model
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class EvidenceType(str, Enum):
    TRANSACTION_RECORD = "transaction_record"
    BATCH_RECORD = "batch_record"
    MEDICINE_RECORD = "medicine_record"
    ENTITY_RECORD = "entity_record"
    FRAUD_EVENT_RECORD = "fraud_event_record"
    TIMELINE_INCONSISTENCY = "timeline_inconsistency"
    RELATIONAL_VIOLATION = "relational_violation"
    QUANTITY_MISMATCH = "quantity_mismatch"
    DUPLICATE_IDENTIFIER = "duplicate_identifier"
    TEMPERATURE_EXCURSION = "temperature_excursion"
    AUTHENTICATION_FAILURE = "authentication_failure"
    COMPUTED_METRIC = "computed_metric"


class ValidationResult(str, Enum):
    VALID = "valid"
    INVALID = "invalid"
    INCONSISTENT = "inconsistent"
    MISSING = "missing"
    NOT_APPLICABLE = "not_applicable"


class EvidenceItem(BaseModel):
    """A single piece of evidence supporting or contradicting an anomaly."""

    evidence_id: str = Field(
        default_factory=lambda: f"EV-{uuid4().hex[:8].upper()}",
        description="Unique evidence identifier",
    )
    source_dataset: str = Field(
        description="Name of the source dataset table (e.g. 'transactions', 'batches')"
    )
    source_record_id: str = Field(
        description="Primary key or composite key identifying the source record"
    )
    evidence_type: EvidenceType = Field(description="Category of this evidence")

    # Optional relational links
    related_entity_id: Optional[str] = Field(
        default=None, description="Related entity_id or manufacturer_id"
    )
    related_batch_id: Optional[str] = Field(
        default=None, description="Related batch_id"
    )
    related_medicine_id: Optional[str] = Field(
        default=None, description="Related medicine_id"
    )

    timestamp: Optional[datetime] = Field(
        default=None, description="Timestamp of the evidenced event"
    )

    # Observed vs expected
    observed_value: Optional[Any] = Field(
        default=None, description="Actual value found in the dataset"
    )
    expected_value: Optional[Any] = Field(
        default=None,
        description="Expected or reference value (from related records or rules)",
    )

    # Validation results
    relationship_validation: ValidationResult = Field(
        default=ValidationResult.NOT_APPLICABLE,
        description="Result of relational integrity check for this evidence item",
    )
    timeline_validation: ValidationResult = Field(
        default=ValidationResult.NOT_APPLICABLE,
        description="Result of chronological check for this evidence item",
    )

    evidence_description: str = Field(
        description="Human-readable explanation of what this evidence shows"
    )

    collected_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When this evidence was collected",
    )

    class Config:
        use_enum_values = True
        json_encoders = {datetime: lambda v: v.isoformat()}
