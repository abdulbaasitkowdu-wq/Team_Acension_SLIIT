"""
PHANTOM — TimelineEvent Pydantic Model
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class TimelineEventType(str, Enum):
    MANUFACTURING = "manufacturing"
    QUALITY_TEST = "quality_test"
    PACKAGING = "packaging"
    WAREHOUSE_IN = "warehouse_in"
    SHIPMENT = "shipment"
    DISTRIBUTOR_RECEIPT = "distributor_receipt"
    PHARMACY_RECEIPT = "pharmacy_receipt"
    SALE = "sale"
    UNKNOWN = "unknown"


class TimelineStatus(str, Enum):
    VALID = "valid"
    CHRONOLOGICAL_VIOLATION = "chronological_violation"
    MISSING_TIMESTAMP = "missing_timestamp"
    MISSING_EVENT = "missing_event"
    DUPLICATE_EVENT = "duplicate_event"


class TimelineEvent(BaseModel):
    """A single event in a batch or transaction timeline."""

    event_id: str = Field(
        default_factory=lambda: f"EVT-{uuid4().hex[:8].upper()}",
        description="Unique event identifier",
    )
    event_type: TimelineEventType = Field(description="Supply-chain stage event type")
    timestamp: Optional[datetime] = Field(
        default=None,
        description="Event timestamp (UTC); None if timestamp is missing",
    )
    entity_id: Optional[str] = Field(
        default=None,
        description="Entity performing this event (manufacturer_id for manufacturing events)",
    )
    batch_id: Optional[str] = Field(default=None, description="Batch ID")
    medicine_id: Optional[str] = Field(default=None, description="Medicine ID")
    transaction_id: Optional[str] = Field(
        default=None, description="Composite transaction reference"
    )
    source_record_id: str = Field(
        description="Dataset record identifier from which this event was derived"
    )
    description: str = Field(description="Human-readable event description")
    status: TimelineStatus = Field(
        default=TimelineStatus.VALID,
        description="Validation status of this individual timeline event",
    )

    # IoT / verification flags (from transactions)
    qr_verified: Optional[bool] = None
    rfid_scanned: Optional[bool] = None
    seal_intact: Optional[bool] = None
    temperature: Optional[float] = None
    is_fraud_ground_truth: Optional[bool] = None
    fraud_type: Optional[str] = None
    duplicate_serial: Optional[bool] = None

    class Config:
        use_enum_values = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class BatchTimeline(BaseModel):
    """Full chronological timeline for a single batch."""

    batch_id: str
    medicine_id: Optional[str] = None
    manufacturer_id: Optional[str] = None

    events: List[TimelineEvent] = Field(
        default_factory=list,
        description="Chronologically ordered events",
    )

    timeline_status: TimelineStatus = Field(
        default=TimelineStatus.VALID,
        description="Overall timeline validation status",
    )
    chronological_inconsistencies: List[str] = Field(
        default_factory=list,
        description="Descriptions of detected chronological violations",
    )
    missing_events: List[str] = Field(
        default_factory=list,
        description="Expected event types that are absent from the timeline",
    )
    duplicate_events: List[str] = Field(
        default_factory=list,
        description="Event types that appear multiple times unexpectedly",
    )

    class Config:
        use_enum_values = True
        json_encoders = {datetime: lambda v: v.isoformat()}
