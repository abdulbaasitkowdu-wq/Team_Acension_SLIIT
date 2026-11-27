"""
PHANTOM Tests — Dataset Loader
Tests dataset loading, schema validation, and record retrieval.
Uses actual dataset files — does not modify them.
"""
from __future__ import annotations

import os
import pytest
import pandas as pd
from pathlib import Path

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def data_dir():
    """Return the data directory path."""
    # Traverse up from tests/ to find the Data/ directory
    base = Path(__file__).parent.parent.parent / "Data"
    if not base.exists():
        pytest.skip(f"Data directory not found: {base}")
    return str(base)


@pytest.fixture(scope="session")
def loaded_store(data_dir):
    """Return a loaded DatasetStore for the session."""
    from app.data_processing.dataset_loader import DatasetStore
    store = DatasetStore()
    store.load(data_dir)
    return store


# ---------------------------------------------------------------------------
# Tests: Dataset Loading
# ---------------------------------------------------------------------------

def test_all_files_exist(data_dir):
    """All five parquet files must exist."""
    for filename in ("batches.parquet", "entities.parquet", "fraud_events.parquet",
                     "medicines.parquet", "transactions.parquet"):
        path = Path(data_dir) / filename
        assert path.exists(), f"Missing dataset file: {path}"


def test_store_loads_without_error(loaded_store):
    assert loaded_store.is_loaded


def test_batches_shape(loaded_store):
    assert loaded_store.batches.shape[0] > 0
    assert "batch_id" in loaded_store.batches.columns
    assert "medicine_id" in loaded_store.batches.columns
    assert "manufacturer_id" in loaded_store.batches.columns


def test_entities_shape(loaded_store):
    assert loaded_store.entities.shape[0] > 0
    assert "entity_id" in loaded_store.entities.columns


def test_medicines_shape(loaded_store):
    assert loaded_store.medicines.shape[0] > 0
    assert "medicine_id" in loaded_store.medicines.columns


def test_fraud_events_shape(loaded_store):
    assert loaded_store.fraud_events.shape[0] > 0
    assert "batch_id" in loaded_store.fraud_events.columns
    assert "is_fraud_ground_truth" in loaded_store.fraud_events.columns


def test_transactions_shape(loaded_store):
    assert loaded_store.transactions.shape[0] > 0
    assert "batch_id" in loaded_store.transactions.columns
    assert "event_type" in loaded_store.transactions.columns
    assert "timestamp" in loaded_store.transactions.columns


def test_transactions_timestamp_timezone(loaded_store):
    """Timestamps must be timezone-aware after loading."""
    ts = loaded_store.transactions["timestamp"]
    assert ts.dt.tz is not None, "Timestamps must be timezone-aware"


def test_batches_no_duplicate_batch_ids(loaded_store):
    assert loaded_store.batches["batch_id"].duplicated().sum() == 0


def test_medicines_no_duplicate_medicine_ids(loaded_store):
    assert loaded_store.medicines["medicine_id"].duplicated().sum() == 0


def test_entities_no_duplicate_entity_ids(loaded_store):
    assert loaded_store.entities["entity_id"].duplicated().sum() == 0


# ---------------------------------------------------------------------------
# Tests: Record Retrieval
# ---------------------------------------------------------------------------

def test_get_batch_returns_correct_record(loaded_store):
    first_batch_id = loaded_store.batches["batch_id"].iloc[0]
    result = loaded_store.get_batch(first_batch_id)
    assert result is not None
    assert result["batch_id"] == first_batch_id


def test_get_batch_returns_none_for_invalid_id(loaded_store):
    result = loaded_store.get_batch("INVALID_BATCH_ID_XYZ")
    assert result is None


def test_get_medicine_returns_correct_record(loaded_store):
    first_med_id = loaded_store.medicines["medicine_id"].iloc[0]
    result = loaded_store.get_medicine(first_med_id)
    assert result is not None
    assert result["medicine_id"] == first_med_id


def test_get_entity_returns_correct_record(loaded_store):
    first_entity_id = loaded_store.entities["entity_id"].iloc[0]
    result = loaded_store.get_entity(first_entity_id)
    assert result is not None
    assert result["entity_id"] == first_entity_id


def test_get_batch_transactions_returns_dataframe(loaded_store):
    first_batch_id = loaded_store.batches["batch_id"].iloc[0]
    txs = loaded_store.get_batch_transactions(first_batch_id)
    assert isinstance(txs, pd.DataFrame)
    assert len(txs) > 0


def test_get_batch_transactions_empty_for_invalid(loaded_store):
    txs = loaded_store.get_batch_transactions("NONEXISTENT_BATCH")
    assert len(txs) == 0


def test_dataset_metadata_populated(loaded_store):
    meta = loaded_store.metadata
    assert "batches" in meta
    assert "transactions" in meta
    assert meta["batches"]["rows"] > 0
    assert meta["transactions"]["rows"] > 0


def test_fraud_ground_truth_labels_present(loaded_store):
    """Ground truth labels must exist and have both True and False values."""
    labels = loaded_store.fraud_events["is_fraud_ground_truth"]
    assert True in labels.values
    assert False in labels.values
