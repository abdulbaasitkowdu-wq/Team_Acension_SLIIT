"""
PHANTOM Tests — Report Generation and Pydantic Validation
"""
from __future__ import annotations

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock


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


@pytest.fixture
def sample_case():
    from app.models.case import AnomalyCategory, InvestigationCase, SeverityLevel
    return InvestigationCase(
        case_id="CASE-TEST0001",
        anomaly_category=AnomalyCategory.DUPLICATE_IDENTIFIER,
        severity=SeverityLevel.HIGH,
        description="Test case with duplicate serial.",
        batch_ids=["BATCH_000003"],
        medicine_ids=["MED_0100"],
        entity_ids=["KSA_MAN_0001"],
        detection_rule="duplicate_serial_flag",
        detection_explanation="Batch BATCH_000003 has duplicate_serial=True.",
        evidence_references=["transactions:BATCH_000003|manufacturing|1"],
        ground_truth_label=True,
        ground_truth_fraud_type="counterfeit",
    )


@pytest.fixture
def sample_assessment():
    from app.models.assessment import AnomalyAssessment, InvestigationStatus
    return AnomalyAssessment(
        anomaly_detected=True,
        anomaly_category="duplicate_identifier",
        severity="high",
        factual_observations=["Batch BATCH_000003 has duplicate_serial=True in manufacturing event."],
        supporting_evidence=["transactions:BATCH_000003|manufacturing|1"],
        contradictory_evidence=[],
        possible_explanations=["Could be a database synchronization issue."],
        missing_information=["Physical inspection not available."],
        confidence=0.80,
        investigation_status=InvestigationStatus.ANOMALY_SUPPORTED,
        assessment_summary=(
            "Batch BATCH_000003 shows a duplicate serial number flag in its manufacturing "
            "transaction record. This is a significant supply-chain anomaly indicator. "
            "However, the possibility of a data entry error cannot be excluded without "
            "physical verification."
        ),
        recommended_human_review_actions=["Review physical batch documentation."],
        limitations=["No physical product inspection capability."],
    )


def test_investigation_case_pydantic_valid(sample_case):
    """InvestigationCase must serialize to valid JSON."""
    data = sample_case.model_dump(mode="json")
    assert "case_id" in data
    assert "anomaly_category" in data
    assert "severity" in data
    json_str = json.dumps(data)
    assert len(json_str) > 0


def test_anomaly_assessment_pydantic_valid(sample_assessment):
    data = sample_assessment.model_dump(mode="json")
    assert "anomaly_detected" in data
    assert 0.0 <= data["confidence"] <= 1.0
    json_str = json.dumps(data)
    assert len(json_str) > 0


def test_evidence_item_pydantic_valid():
    from app.models.evidence import EvidenceItem, EvidenceType
    item = EvidenceItem(
        source_dataset="transactions",
        source_record_id="BATCH_000003|manufacturing|1",
        evidence_type=EvidenceType.TRANSACTION_RECORD,
        evidence_description="Transaction record for BATCH_000003 manufacturing event.",
    )
    data = item.model_dump(mode="json")
    assert "evidence_id" in data
    json.dumps(data)


def test_evaluation_metrics_auto_computes_precision():
    from app.models.metrics import EvaluationMetrics
    m = EvaluationMetrics(
        true_positive=80,
        false_positive=20,
        true_negative=90,
        false_negative=10,
        total_cases=200,
        investigated_cases=200,
    )
    assert m.precision == pytest.approx(80 / 100, rel=1e-5)
    assert m.recall == pytest.approx(80 / 90, rel=1e-5)
    assert m.f1_score is not None
    assert m.false_positive_rate == pytest.approx(20 / 110, rel=1e-5)


def test_evaluation_metrics_handles_zero_denominator():
    from app.models.metrics import EvaluationMetrics
    m = EvaluationMetrics(
        true_positive=0,
        false_positive=0,
        true_negative=100,
        false_negative=0,
        total_cases=100,
        investigated_cases=100,
    )
    # TP+FP = 0, so precision = None
    assert m.precision is None
    # FP+TN = 100, so FPR = 0
    assert m.false_positive_rate == 0.0


def test_report_pydantic_valid(loaded_store, sample_case, sample_assessment):
    from app.reporting.report_generator import ReportGenerator
    gen = ReportGenerator(loaded_store)
    report = gen.generate_case_report(
        case=sample_case,
        assessment=sample_assessment,
        relational_summary={},
    )
    assert report.report_id is not None
    assert report.case_id == "CASE-TEST0001"
    # Must be JSON serializable
    dashboard_dict = report.to_dashboard_dict()
    json_str = json.dumps(dashboard_dict, default=str)
    assert len(json_str) > 0


def test_report_contains_required_sections(loaded_store, sample_case, sample_assessment):
    from app.reporting.report_generator import ReportGenerator
    gen = ReportGenerator(loaded_store)
    report = gen.generate_case_report(
        case=sample_case,
        assessment=sample_assessment,
        relational_summary={},
    )
    data = report.to_dashboard_dict()
    # Check required sections exist
    assert "case_details" in data
    assert "anomaly_assessment" in data
    assert "relational_validation_summary" in data
    assert "evidence_log" in data
    assert "limitations" in data
    assert "final_evaluation_result" in data


def test_report_limitations_are_non_empty(loaded_store, sample_case, sample_assessment):
    from app.reporting.report_generator import ReportGenerator
    gen = ReportGenerator(loaded_store)
    report = gen.generate_case_report(
        case=sample_case,
        assessment=sample_assessment,
        relational_summary={},
    )
    assert len(report.limitations) > 0
