"""
PHANTOM — Dataset Mapping Layer
Maps actual dataset column names to canonical PHANTOM field names.
Inspect data first; never invent columns that don't exist.

This mapping was derived from inspecting the actual parquet files:
  - batches.parquet      (60,000 rows × 9 cols)
  - entities.parquet     (2,048 rows × 21 cols)
  - fraud_events.parquet (60,000 rows × 4 cols)
  - medicines.parquet    (300 rows × 7 cols)
  - transactions.parquet (1,201,800 rows × 27 cols)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class TableMapping:
    """Column mapping for a single dataset table."""
    table_name: str
    file_name: str
    primary_key: str
    # column_name -> canonical_name
    columns: Dict[str, str] = field(default_factory=dict)
    # canonical_names that are unavailable in this table
    unavailable_fields: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# BATCHES TABLE
# ---------------------------------------------------------------------------
BATCHES_MAPPING = TableMapping(
    table_name="batches",
    file_name="batches.parquet",
    primary_key="batch_id",
    columns={
        "batch_id": "batch_id",
        "medicine_id": "medicine_id",
        "manufacturer_id": "manufacturer_id",
        "country_of_origin": "country_of_origin",
        "production_date": "production_date",
        "expiry_date": "expiry_date",
        "quantity": "quantity",
        "serial_number": "serial_number",
        "lot_number": "lot_number",
    },
    unavailable_fields=[
        "entity_id",          # entities are only via manufacturer_id
        "dispatch_date",      # not in batches; use transactions.timestamp for manufacturing
        "distributor_id",
        "shipment_id",
    ],
)

# ---------------------------------------------------------------------------
# ENTITIES TABLE
# ---------------------------------------------------------------------------
ENTITIES_MAPPING = TableMapping(
    table_name="entities",
    file_name="entities.parquet",
    primary_key="entity_id",
    columns={
        "entity_id": "entity_id",
        "entity_type": "entity_type",
        "country": "country",
        "regulator": "regulator",
        "enforcement_level": "enforcement_level",
        "city": "city",
        "latitude": "latitude",
        "longitude": "longitude",
        "license_number": "license_number",
        "license_status": "license_status",
        "license_expiry": "license_expiry",
        "gmp_compliant": "gmp_compliant",
        "pics_compliant": "pics_compliant",
        "sfda_gmp_status": "sfda_gmp_status",
        "audit_score": "audit_score",
        "years_of_operation": "years_of_operation",
        "is_importer": "is_importer",
        "import_certificate": "import_certificate",
        "export_certificate": "export_certificate",
        "customs_clearance": "customs_clearance",
        "batch_release_certificate": "batch_release_certificate",
    },
    unavailable_fields=[
        "batch_id",
        "transaction_id",
    ],
)

# ---------------------------------------------------------------------------
# FRAUD_EVENTS TABLE
# ---------------------------------------------------------------------------
FRAUD_EVENTS_MAPPING = TableMapping(
    table_name="fraud_events",
    file_name="fraud_events.parquet",
    primary_key="batch_id",          # one fraud_event record per batch
    columns={
        "batch_id": "batch_id",
        "is_fraud_ground_truth": "is_fraud_ground_truth",
        "fraud_type": "fraud_type",
        "in_ring": "in_ring",
    },
    unavailable_fields=[
        "entity_id",
        "transaction_id",
    ],
)

# ---------------------------------------------------------------------------
# MEDICINES TABLE
# ---------------------------------------------------------------------------
MEDICINES_MAPPING = TableMapping(
    table_name="medicines",
    file_name="medicines.parquet",
    primary_key="medicine_id",
    columns={
        "medicine_id": "medicine_id",
        "drug_type": "drug_type",
        "storage_min": "storage_min",
        "storage_max": "storage_max",
        "is_cold_chain": "is_cold_chain",
        "shelf_life_days": "shelf_life_days",
        "price": "price",
    },
    unavailable_fields=[
        "batch_id",
    ],
)

# ---------------------------------------------------------------------------
# TRANSACTIONS TABLE
# ---------------------------------------------------------------------------
# event_type values (ordered supply-chain sequence):
#   manufacturing → quality_test → packaging → warehouse_in →
#   shipment → distributor_receipt → pharmacy_receipt → sale
TRANSACTIONS_MAPPING = TableMapping(
    table_name="transactions",
    file_name="transactions.parquet",
    primary_key=None,                # No single-column primary key; composite
    columns={
        "batch_id": "batch_id",
        "country": "country",
        "event_type": "event_type",
        "leg": "leg",
        "timestamp": "timestamp",
        "temperature": "temperature",
        "humidity": "humidity",
        "gps_lat": "gps_lat",
        "gps_lng": "gps_lng",
        "qr_verified": "qr_verified",
        "rfid_scanned": "rfid_scanned",
        "seal_intact": "seal_intact",
        "weight": "weight",
        "door_open": "door_open",
        "battery_level": "battery_level",
        "sensor_id": "sensor_id",
        "is_fraud_ground_truth": "is_fraud_ground_truth",
        "fraud_type": "fraud_type",
        "is_masked": "is_masked",
        "is_suspicious_genuine": "is_suspicious_genuine",
        "is_fraud_detected": "is_fraud_detected",
        "previous_hash": "previous_hash",
        "current_hash": "current_hash",
        "batch_tx_index": "batch_tx_index",
        "rolling_excursion_rate": "rolling_excursion_rate",
        "duplicate_serial": "duplicate_serial",
        "cumulative_excursion_time": "cumulative_excursion_time",
    },
    unavailable_fields=[
        "entity_id",          # no entity_id in transactions
        "transaction_id",     # no dedicated transaction_id column; use batch_id+event_type+batch_tx_index
        "quantity",           # quantity is in batches, not transactions
        "dispatch_date",      # event_type=shipment timestamp serves as dispatch
        "receipt_date",       # event_type=distributor_receipt timestamp
    ],
)

# ---------------------------------------------------------------------------
# SUPPLY-CHAIN EVENT SEQUENCE
# ---------------------------------------------------------------------------
SUPPLY_CHAIN_SEQUENCE: List[str] = [
    "manufacturing",
    "quality_test",
    "packaging",
    "warehouse_in",
    "shipment",
    "distributor_receipt",
    "pharmacy_receipt",
    "sale",
]

# Event type to canonical stage name
EVENT_STAGE_LABELS: Dict[str, str] = {
    "manufacturing": "Manufacturing",
    "quality_test": "Quality Control",
    "packaging": "Packaging",
    "warehouse_in": "Warehouse Inbound",
    "shipment": "Shipment/Dispatch",
    "distributor_receipt": "Distributor Receipt",
    "pharmacy_receipt": "Pharmacy Receipt",
    "sale": "Point of Sale",
}

# ---------------------------------------------------------------------------
# FRAUD TYPES
# ---------------------------------------------------------------------------
FRAUD_TYPES: List[str] = [
    "counterfeit",
    "diversion",
    "fake_qr",
    "temperature",
    "tampering",
    "unauthorized_manufacturer",
    "duplicate_batch",
    "theft",
    "relabel",
]

# ---------------------------------------------------------------------------
# ALL MAPPINGS (registry)
# ---------------------------------------------------------------------------
ALL_MAPPINGS: Dict[str, TableMapping] = {
    "batches": BATCHES_MAPPING,
    "entities": ENTITIES_MAPPING,
    "fraud_events": FRAUD_EVENTS_MAPPING,
    "medicines": MEDICINES_MAPPING,
    "transactions": TRANSACTIONS_MAPPING,
}
