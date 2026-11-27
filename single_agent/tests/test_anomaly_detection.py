"""
PHANTOM Tests — Anomaly Detection
Tests all deterministic anomaly detectors.
"""
from __future__ import annotations

import pytest
import pandas as pd
from datetime import datetime, timezone


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
def detector(loaded_store):
    from app.detection.anomaly_detector import AnomalyDetector
    return AnomalyDetector(
        batches=loaded_store.batches,
        entities=loaded_store.entities,
        medicines=loaded_store.medicines,
        fraud_events=loaded_store.fraud_events,
        transactions=loaded_store.transactions,
    )


def test_duplicate_serial_detector_runs(detector):
    cases = detector.detect_duplicate_serials()
    assert isinstance(cases, list)


def test_duplicate_serial_cases_have_correct_category(detector):
    from app.models.case import AnomalyCategory
    cases = detector.detect_duplicate_serials()
    for case in cases[:5]:
        assert case.anomaly_category == AnomalyCategory.DUPLICATE_IDENTIFIER


def test_temperature_excursion_detector_runs(detector):
    cases = detector.detect_temperature_excursions()
    assert isinstance(cases, list)


def test_fraud_detected_anomalies_detector_runs(detector):
    cases = detector.detect_fraud_detected_anomalies()
    assert isinstance(cases, list)
    # Must detect at least some fraud-detected cases
    assert len(cases) > 0


def test_all_cases_have_required_fields(detector):
    cases = detector.run_all_detectors(limit_per_rule=5)
    for case in cases:
        assert case.case_id is not None
        assert case.anomaly_category is not None
        assert case.severity is not None
        assert case.detection_rule is not None
        assert len(case.batch_ids) > 0 or len(case.transaction_ids) > 0


def test_cases_preserve_ground_truth_labels(detector):
    """Ground truth labels must come from the dataset, not be invented."""
    cases = detector.run_all_detectors(limit_per_rule=10)
    for case in cases:
        # ground_truth_label is either True, False, or None — never fabricated
        assert case.ground_truth_label in (True, False, None)


def test_case_prioritization_filters_severity():
    """Case prioritization must respect min_severity filter."""
    from app.detection.case_creator import prioritize_cases
    from app.models.case import AnomalyCategory, InvestigationCase, SeverityLevel

    cases = [
        InvestigationCase(
            anomaly_category=AnomalyCategory.DUPLICATE_IDENTIFIER,
            severity=SeverityLevel.LOW,
            description="Low severity case",
            batch_ids=["BATCH_LOW"],
            detection_rule="test",
            detection_explanation="test",
        ),
        InvestigationCase(
            anomaly_category=AnomalyCategory.COUNTERFEIT_INDICATOR,
            severity=SeverityLevel.HIGH,
            description="High severity case",
            batch_ids=["BATCH_HIGH"],
            detection_rule="test",
            detection_explanation="test",
        ),
    ]

    result = prioritize_cases(cases, max_cases=50, min_severity=SeverityLevel.MEDIUM)
    assert all(c.severity != SeverityLevel.LOW for c in result)
    assert len(result) == 1  # only high severity


def test_legitimate_batch_not_always_flagged(loaded_store):
    """
    At least some batches should NOT be flagged by all detectors.
    The system must not flag everything as suspicious.
    """
    from app.detection.anomaly_detector import AnomalyDetector

    # Take legit batches (ground truth = False)
    legit_batch_ids = set(
        loaded_store.fraud_events[
            loaded_store.fraud_events["is_fraud_ground_truth"] == False
        ]["batch_id"].head(100)
    )

    det = AnomalyDetector(
        batches=loaded_store.batches[loaded_store.batches["batch_id"].isin(legit_batch_ids)],
        entities=loaded_store.entities,
        medicines=loaded_store.medicines,
        fraud_events=loaded_store.fraud_events[
            loaded_store.fraud_events["batch_id"].isin(legit_batch_ids)
        ],
        transactions=loaded_store.transactions[
            loaded_store.transactions["batch_id"].isin(legit_batch_ids)
        ],
    )
    cases = det.detect_duplicate_serials()
    # Not all legit batches should have duplicate serials
    flagged_batches = {bid for c in cases for bid in c.batch_ids}
    unflagged = legit_batch_ids - flagged_batches
    assert len(unflagged) > 0, "All legitimate batches were flagged — false positive rate too high"
