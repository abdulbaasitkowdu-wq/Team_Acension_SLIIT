"""
PHANTOM Tests — Evaluation Metrics Calculation
"""
from __future__ import annotations

import pytest


def test_metrics_precision_recall_f1():
    from app.models.metrics import EvaluationMetrics
    m = EvaluationMetrics(
        true_positive=70,
        false_positive=30,
        true_negative=80,
        false_negative=20,
        total_cases=200,
        investigated_cases=200,
    )
    expected_precision = 70 / 100
    expected_recall = 70 / 90
    assert m.precision == pytest.approx(expected_precision, rel=1e-5)
    assert m.recall == pytest.approx(expected_recall, rel=1e-5)
    assert m.f1_score == pytest.approx(
        2 * expected_precision * expected_recall / (expected_precision + expected_recall), rel=1e-5
    )


def test_metrics_fpr():
    from app.models.metrics import EvaluationMetrics
    m = EvaluationMetrics(
        true_positive=50,
        false_positive=10,
        true_negative=90,
        false_negative=50,
        total_cases=200,
        investigated_cases=200,
    )
    assert m.false_positive_rate == pytest.approx(10 / 100, rel=1e-5)


def test_metrics_null_when_no_counts():
    from app.models.metrics import EvaluationMetrics
    m = EvaluationMetrics(total_cases=10, investigated_cases=5)
    assert m.precision is None
    assert m.recall is None
    assert m.f1_score is None
    assert m.false_positive_rate is None


def test_metrics_token_sum():
    from app.models.metrics import EvaluationMetrics
    m = EvaluationMetrics(
        total_cases=5,
        investigated_cases=5,
        prompt_tokens=1000,
        completion_tokens=500,
    )
    assert m.total_token_usage == 1500


def test_metrics_calculator_runs():
    from app.evaluation.metrics_calculator import MetricsCalculator
    from app.models.case import AnomalyCategory, InvestigationCase, SeverityLevel
    from app.models.assessment import AnomalyAssessment, InvestigationStatus

    cases = [
        InvestigationCase(
            case_id="C001",
            anomaly_category=AnomalyCategory.DUPLICATE_IDENTIFIER,
            severity=SeverityLevel.HIGH,
            description="Test",
            batch_ids=["B001"],
            detection_rule="test",
            detection_explanation="test",
            ground_truth_label=True,
        ),
        InvestigationCase(
            case_id="C002",
            anomaly_category=AnomalyCategory.MASKED_TRANSACTION,
            severity=SeverityLevel.MEDIUM,
            description="Test",
            batch_ids=["B002"],
            detection_rule="test",
            detection_explanation="test",
            ground_truth_label=False,
        ),
    ]

    assessments = {
        "C001": AnomalyAssessment(
            anomaly_detected=True,
            anomaly_category="duplicate_identifier",
            severity="high",
            factual_observations=["Fact 1"],
            supporting_evidence=["Ev1"],
            confidence=0.9,
            investigation_status=InvestigationStatus.ANOMALY_SUPPORTED,
            assessment_summary="Case C001 is supported by evidence.",
            limitations=["Limited scope."],
        ),
        "C002": AnomalyAssessment(
            anomaly_detected=False,
            anomaly_category="masked_transaction",
            severity="medium",
            factual_observations=["Fact 1"],
            supporting_evidence=[],
            confidence=0.2,
            investigation_status=InvestigationStatus.ANOMALY_UNSUPPORTED,
            assessment_summary="Case C002 appears legitimate.",
            limitations=["Limited scope."],
        ),
    }

    usage_metadata = {
        "C001": {"measured": True, "prompt_tokens": 500, "completion_tokens": 200, "investigation_time": 1.5},
        "C002": {"measured": True, "prompt_tokens": 450, "completion_tokens": 180, "investigation_time": 1.2},
    }

    calc = MetricsCalculator()
    metrics = calc.calculate(cases, assessments, usage_metadata)

    # C001: GT=True, pred=True → TP
    # C002: GT=False, pred=False → TN
    assert metrics.true_positive == 1
    assert metrics.true_negative == 1
    assert metrics.false_positive == 0
    assert metrics.false_negative == 0
    assert metrics.precision == 1.0
    assert metrics.recall == 1.0
    assert metrics.f1_score == pytest.approx(1.0)
