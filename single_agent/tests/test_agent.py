"""
PHANTOM Tests — Investigation Agent
Tests evidence retrieval tools and report structure validation.
Does NOT make real LLM calls (uses mock).
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch
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
def sample_case(loaded_store):
    from app.detection.anomaly_detector import AnomalyDetector
    det = AnomalyDetector(
        batches=loaded_store.batches,
        entities=loaded_store.entities,
        medicines=loaded_store.medicines,
        fraud_events=loaded_store.fraud_events,
        transactions=loaded_store.transactions,
    )
    cases = det.run_all_detectors(limit_per_rule=1)
    if not cases:
        pytest.skip("No cases detected for agent testing.")
    return cases[0]


def test_evidence_tools_get_batch_records(loaded_store, sample_case):
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)
    batch_id = sample_case.batch_ids[0]
    result = tools.get_batch_records(batch_id)
    assert result["found"] is True
    assert "data" in result


def test_evidence_tools_get_medicine_records(loaded_store, sample_case):
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)
    if not sample_case.medicine_ids:
        pytest.skip("No medicine IDs in case.")
    result = tools.get_medicine_records(sample_case.medicine_ids[0])
    assert result["found"] is True


def test_evidence_tools_get_related_transactions(loaded_store, sample_case):
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)
    batch_id = sample_case.batch_ids[0]
    result = tools.get_related_transactions(batch_id)
    assert "count" in result
    assert result["count"] > 0


def test_evidence_tools_get_batch_timeline(loaded_store, sample_case):
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)
    batch_id = sample_case.batch_ids[0]
    result = tools.get_batch_timeline(batch_id)
    assert "batch_id" in result
    assert "events" in result


def test_evidence_tools_validate_batch_relationships(loaded_store, sample_case):
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)
    batch_id = sample_case.batch_ids[0]
    result = tools.validate_batch_relationships(batch_id)
    assert "batch_id" in result
    assert "total_checks" in result


def test_evidence_tools_get_anomaly_evidence(loaded_store, sample_case):
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)
    items = tools.get_anomaly_evidence(sample_case)
    assert len(items) > 0
    for item in items:
        assert "source" in item
        assert "data" in item


def test_evidence_summary_for_llm_has_case_info(loaded_store, sample_case):
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)
    summary = tools.summarize_evidence_for_llm(sample_case)
    assert sample_case.case_id in summary
    assert sample_case.anomaly_category in summary


def test_no_ground_truth_leakage_in_agent_evidence(loaded_store, sample_case):
    """Ensure ground-truth labels never leak into agent evidence or LLM prompt context."""
    from app.agent.tools import EvidenceTools
    tools = EvidenceTools(loaded_store)

    evidence_items = tools.get_anomaly_evidence(sample_case)
    sources = {item["source"] for item in evidence_items}
    assert "fraud_events" not in sources

    batch_id = sample_case.batch_ids[0]
    txs = tools.get_related_transactions(batch_id)
    for rec in txs.get("records", []):
        assert "is_fraud_ground_truth" not in rec
        assert "fraud_type" not in rec
        assert "in_ring" not in rec

    timeline = tools.get_batch_timeline(batch_id)
    for evt in timeline.get("events", []):
        assert "is_fraud_ground_truth" not in evt
        assert "fraud_type" not in evt

    summary = tools.summarize_evidence_for_llm(sample_case)
    assert "is_fraud_ground_truth" not in summary
    assert "fraud_events" not in summary
    assert "in_ring" not in summary


def test_agent_investigate_with_mock_llm(loaded_store, sample_case):
    """Test agent investigation with mocked LLM to avoid real API calls."""
    import json
    from app.agent.investigator import PhantomInvestigationAgent

    mock_response_content = json.dumps({
        "anomaly_detected": True,
        "anomaly_category": sample_case.anomaly_category,
        "severity": "high",
        "factual_observations": [
            f"Record {sample_case.evidence_references[0]} shows anomalous pattern.",
            f"Batch {sample_case.batch_ids[0]} has flagged transactions.",
        ],
        "supporting_evidence": ["Evidence from transactions table."],
        "contradictory_evidence": [],
        "possible_explanations": ["Could be a data entry error or duplicate recording."],
        "missing_information": ["Chain of custody documentation not available."],
        "confidence": 0.75,
        "investigation_status": "anomaly_supported",
        "assessment_summary": (
            f"Investigation of case {sample_case.case_id} reveals suspicious patterns. "
            f"Record {sample_case.evidence_references[0] if sample_case.evidence_references else 'N/A'} "
            f"shows anomalous indicators. Further human review is recommended."
        ),
        "recommended_human_review_actions": ["Review batch records manually."],
        "limitations": ["Automated assessment only — no legal determination."],
    })

    mock_response = MagicMock()
    mock_response.content = mock_response_content
    mock_response.usage_metadata = None
    mock_response.response_metadata = {}

    agent = PhantomInvestigationAgent(loaded_store)

    with patch.object(agent, "_llm", create=True) as mock_llm:
        mock_llm.invoke = MagicMock(return_value=mock_response)
        agent._llm = mock_llm

        assessment, usage = agent.investigate_case(sample_case)

    assert assessment is not None
    assert assessment.anomaly_detected is True
    assert assessment.confidence == 0.75
    assert len(assessment.factual_observations) >= 2
    assert "investigation_time" in usage
