"""
PHANTOM Tests — Relational Validation
"""
from __future__ import annotations

import pytest
import pandas as pd


@pytest.fixture(scope="session")
def data_dir():
    from pathlib import Path
    base = Path(__file__).parent.parent.parent / "Data"
    if not base.exists():
        pytest.skip(f"Data directory not found: {base}")
    return str(base)


@pytest.fixture(scope="session")
def loaded_store(data_dir):
    from app.data_processing.dataset_loader import DatasetStore
    store = DatasetStore()
    store.load(data_dir)
    return store


@pytest.fixture(scope="session")
def validator(loaded_store):
    from app.validation.relational_validator import RelationalValidator
    return RelationalValidator(
        batches=loaded_store.batches,
        entities=loaded_store.entities,
        medicines=loaded_store.medicines,
        fraud_events=loaded_store.fraud_events,
        transactions=loaded_store.transactions,
    )


def test_valid_batch_passes_medicine_check(loaded_store, validator):
    """A legitimate batch must pass medicine reference check."""
    batch_id = loaded_store.batches["batch_id"].iloc[0]
    result = validator.validate_batch_medicine_reference(batch_id)
    from app.validation.relational_validator import ValidationStatus
    assert result.status == ValidationStatus.PASS


def test_valid_batch_passes_manufacturer_check(loaded_store, validator):
    batch_id = loaded_store.batches["batch_id"].iloc[0]
    result = validator.validate_batch_manufacturer_reference(batch_id)
    from app.validation.relational_validator import ValidationStatus
    assert result.status == ValidationStatus.PASS


def test_invalid_batch_fails_medicine_check(validator):
    """An invalid batch_id must return a FAIL status."""
    result = validator.validate_batch_medicine_reference("FAKE_BATCH_000")
    from app.validation.relational_validator import ValidationStatus
    assert result.status == ValidationStatus.FAIL


def test_invalid_entity_fails_license_check(validator):
    result = validator.validate_entity_license("NONEXISTENT_ENTITY")
    from app.validation.relational_validator import ValidationStatus
    assert result.status == ValidationStatus.FAIL


def test_valid_transaction_batch_reference(loaded_store, validator):
    batch_id = loaded_store.batches["batch_id"].iloc[0]
    result = validator.validate_transaction_batch_reference(batch_id)
    from app.validation.relational_validator import ValidationStatus
    assert result.status == ValidationStatus.PASS


def test_full_batch_validation_returns_summary(loaded_store, validator):
    batch_id = loaded_store.batches["batch_id"].iloc[0]
    result = validator.validate_batch(batch_id)
    assert "batch_id" in result
    assert "total_checks" in result
    assert result["total_checks"] > 0
    assert "results" in result


def test_full_validation_run(loaded_store, validator):
    batch_ids = list(loaded_store.batches["batch_id"].head(50))
    result = validator.run_full_validation(batch_ids)
    assert "total_checks" in result
    assert result["total_checks"] > 0
    assert result["passed"] >= 0


def test_all_batches_have_valid_medicine_refs(loaded_store, validator):
    """
    All batches in the dataset should reference medicine_ids that exist in medicines.
    """
    valid_meds = set(loaded_store.medicines["medicine_id"])
    invalid_batches = loaded_store.batches[~loaded_store.batches["medicine_id"].isin(valid_meds)]
    assert len(invalid_batches) == 0, (
        f"{len(invalid_batches)} batches have invalid medicine_id references"
    )
