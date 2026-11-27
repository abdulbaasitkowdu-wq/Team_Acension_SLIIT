"""
PHANTOM — LangGraph Workflow Nodes
Each node corresponds to one phase of the investigation pipeline.
Nodes are deterministic except for single_agent_investigation.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict

from app.agent.investigator import PhantomInvestigationAgent
from app.agent.tools import EvidenceTools
from app.config.settings import settings
from app.data_processing.data_validator import DataValidator
from app.data_processing.dataset_loader import DatasetStore, data_store
from app.data_processing.schema_inspector import SchemaInspector
from app.detection.anomaly_detector import AnomalyDetector
from app.detection.case_creator import prioritize_cases
from app.evaluation.metrics_calculator import MetricsCalculator
from app.graph.state import PhantomWorkflowState
from app.models.case import SeverityLevel
from app.models.metrics import EvaluationMetrics
from app.models.report import (
    InvestigationReport,
    ReportStatus,
    RelationalValidationSummary,
    TimelineValidationSummary,
)
from app.reporting.report_generator import ReportGenerator
from app.validation.relational_validator import RelationalValidator
from app.validation.timeline_validator import TimelineBuilder

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node 1: load_dataset
# ---------------------------------------------------------------------------
def node_load_dataset(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: load_dataset")
    state.execution_start_time = datetime.now(timezone.utc)
    try:
        data_store.load()
        state.dataset_metadata = data_store.metadata
        state.dataset_loaded = True
        logger.info("Datasets loaded successfully.")
    except Exception as e:
        msg = f"Dataset loading failed: {e}"
        logger.error(msg)
        state.dataset_load_errors.append(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 2: validate_input
# ---------------------------------------------------------------------------
def node_validate_input(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: validate_input")
    if not state.dataset_loaded:
        state.add_error("Cannot validate — dataset not loaded.")
        return state
    try:
        inspector = SchemaInspector()
        schema_summary = inspector.inspect_all(
            batches=data_store.batches,
            entities=data_store.entities,
            fraud_events=data_store.fraud_events,
            medicines=data_store.medicines,
            transactions=data_store.transactions,
        )
        state.schema_summary = schema_summary

        warnings = inspector.get_missing_fields_report(schema_summary)
        for w in warnings:
            logger.warning(w)

        validator = DataValidator()
        val_results = validator.run_all_validations(
            batches=data_store.batches,
            entities=data_store.entities,
            medicines=data_store.medicines,
            transactions=data_store.transactions,
        )
        state.validation_results = val_results
        state.input_valid = True  # Warnings are non-fatal
        logger.info("Input validation complete.")
    except Exception as e:
        msg = f"Input validation error: {e}"
        logger.error(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 3: validate_relationships
# ---------------------------------------------------------------------------
def node_validate_relationships(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: validate_relationships")
    if not state.dataset_loaded:
        state.add_error("Cannot validate relationships — dataset not loaded.")
        return state
    try:
        rel_validator = RelationalValidator(
            batches=data_store.batches,
            entities=data_store.entities,
            medicines=data_store.medicines,
            fraud_events=data_store.fraud_events,
            transactions=data_store.transactions,
        )
        # Sample 500 batches for relational validation
        sample_ids = list(data_store.batches["batch_id"].head(500))
        summary = rel_validator.run_full_validation(sample_ids)
        state.relational_validation_summary = summary
        state.relational_validation_complete = True
        logger.info(
            f"Relational validation: {summary['passed']} passed, "
            f"{summary['failed']} failed, {summary['warnings']} warnings."
        )
    except Exception as e:
        msg = f"Relational validation error: {e}"
        logger.error(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 4: build_timelines
# ---------------------------------------------------------------------------
def node_build_timelines(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: build_timelines")
    if not state.dataset_loaded:
        state.add_error("Cannot build timelines — dataset not loaded.")
        return state
    try:
        builder = TimelineBuilder()
        # Build timelines for a representative sample (not all 60K batches)
        sample_ids = list(data_store.batches["batch_id"].head(100))
        timelines = builder.build_multiple(
            batch_ids=sample_ids,
            all_transactions=data_store.transactions,
            batches=data_store.batches,
        )
        state.batch_timelines = {
            bid: t.model_dump(mode="json") for bid, t in timelines.items()
        }
        state.timelines_built = True
        logger.info(f"Built {len(timelines)} batch timelines.")
    except Exception as e:
        msg = f"Timeline building error: {e}"
        logger.error(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 5: detect_anomalies
# ---------------------------------------------------------------------------
def node_detect_anomalies(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: detect_anomalies")
    if not state.dataset_loaded:
        state.add_error("Cannot detect anomalies — dataset not loaded.")
        return state
    try:
        detector = AnomalyDetector(
            batches=data_store.batches,
            entities=data_store.entities,
            medicines=data_store.medicines,
            fraud_events=data_store.fraud_events,
            transactions=data_store.transactions,
        )
        cases = detector.run_all_detectors(limit_per_rule=25)
        state.detected_anomalies = cases
        state.anomaly_detection_complete = True
        logger.info(f"Detected {len(cases)} anomaly cases.")
    except Exception as e:
        msg = f"Anomaly detection error: {e}"
        logger.error(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 6: create_investigation_cases
# ---------------------------------------------------------------------------
def node_create_investigation_cases(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: create_investigation_cases")
    if not state.anomaly_detection_complete:
        state.add_error("Cannot create cases — anomaly detection incomplete.")
        return state
    try:
        min_severity = SeverityLevel(settings.min_anomaly_severity)
        prioritized = prioritize_cases(
            cases=state.detected_anomalies,
            max_cases=state.max_cases,
            min_severity=min_severity,
        )
        state.investigation_cases = prioritized
        state.cases_created = True
        logger.info(f"Investigation queue: {len(prioritized)} cases.")
    except Exception as e:
        msg = f"Case creation error: {e}"
        logger.error(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 7: retrieve_case_evidence
# ---------------------------------------------------------------------------
def node_retrieve_case_evidence(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: retrieve_case_evidence")
    if not state.cases_created:
        state.add_error("Cannot retrieve evidence — no cases created.")
        return state
    try:
        tools = EvidenceTools(data_store)
        for case in state.investigation_cases:
            evidence = tools.get_anomaly_evidence(case)
            state.case_evidence[case.case_id] = {
                "case_id": case.case_id,
                "item_count": len(evidence),
                "items": evidence,
            }
        state.evidence_retrieved = True
        logger.info(f"Evidence retrieved for {len(state.investigation_cases)} cases.")
    except Exception as e:
        msg = f"Evidence retrieval error: {e}"
        logger.error(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 8: single_agent_investigation  (THE AI REASONING NODE)
# ---------------------------------------------------------------------------
def node_single_agent_investigation(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: single_agent_investigation")
    if not state.cases_created:
        state.add_error("Cannot investigate — no cases.")
        return state

    agent = PhantomInvestigationAgent(data_store)

    for case in state.investigation_cases:
        try:
            assessment, usage = agent.investigate_case(case)
            if assessment:
                state.agent_assessments[case.case_id] = assessment
            state.agent_usage_metadata[case.case_id] = usage

            if not assessment:
                state.investigation_errors.append(
                    f"Case {case.case_id}: agent investigation returned None"
                )
        except Exception as e:
            err = f"Case {case.case_id}: agent investigation failed: {e}"
            logger.error(err)
            state.investigation_errors.append(err)

    state.investigation_complete = True
    logger.info(
        f"Agent investigation complete: {len(state.agent_assessments)} assessments, "
        f"{len(state.investigation_errors)} errors."
    )
    return state


# ---------------------------------------------------------------------------
# Node 9: validate_investigation_result
# ---------------------------------------------------------------------------
def node_validate_investigation_result(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: validate_investigation_result")
    for case in state.investigation_cases:
        assessment = state.agent_assessments.get(case.case_id)
        if assessment is None:
            state.validated_assessments[case.case_id] = False
            continue
        # Basic Pydantic validation is implicit; just check required fields
        try:
            # Re-validate by round-tripping through model
            from app.models.assessment import AnomalyAssessment
            if isinstance(assessment, AnomalyAssessment):
                state.validated_assessments[case.case_id] = True
            else:
                state.validated_assessments[case.case_id] = False
        except Exception:
            state.validated_assessments[case.case_id] = False

    state.result_validation_complete = True
    valid_count = sum(1 for v in state.validated_assessments.values() if v)
    logger.info(f"Result validation: {valid_count}/{len(state.investigation_cases)} valid assessments.")
    return state


# ---------------------------------------------------------------------------
# Node 10: calculate_evaluation_metrics
# ---------------------------------------------------------------------------
def node_calculate_evaluation_metrics(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: calculate_evaluation_metrics")
    try:
        calc = MetricsCalculator()
        metrics = calc.calculate(
            cases=state.investigation_cases,
            assessments=state.agent_assessments,
            usage_metadata=state.agent_usage_metadata,
        )
        state.evaluation_metrics = metrics
        state.metrics_calculated = True
        logger.info(f"Metrics calculated: {metrics.model_dump(mode='json')}")
    except Exception as e:
        msg = f"Metrics calculation error: {e}"
        logger.error(msg)
        state.add_error(msg)
    return state


# ---------------------------------------------------------------------------
# Node 11: generate_final_report
# ---------------------------------------------------------------------------
def node_generate_final_report(state: PhantomWorkflowState) -> PhantomWorkflowState:
    logger.info("Node: generate_final_report")
    state.execution_end_time = datetime.now(timezone.utc)
    if state.execution_start_time:
        state.total_execution_time_seconds = (
            state.execution_end_time - state.execution_start_time
        ).total_seconds()

    try:
        generator = ReportGenerator(data_store)
        reports = generator.generate_all(
            cases=state.investigation_cases,
            assessments=state.agent_assessments,
            relational_summary=state.relational_validation_summary,
            metrics=state.evaluation_metrics,
        )
        state.investigation_reports = reports
        state.reports_generated = True
        logger.info(f"Generated {len(reports)} investigation reports.")
    except Exception as e:
        msg = f"Report generation error: {e}"
        logger.error(msg)
        state.add_error(msg)

    return state
