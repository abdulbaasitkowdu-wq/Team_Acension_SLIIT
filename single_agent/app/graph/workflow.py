"""
PHANTOM — LangGraph Workflow Definition
Builds and compiles the investigation graph.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from app.graph.nodes import (
    node_build_timelines,
    node_calculate_evaluation_metrics,
    node_create_investigation_cases,
    node_detect_anomalies,
    node_generate_final_report,
    node_load_dataset,
    node_retrieve_case_evidence,
    node_single_agent_investigation,
    node_validate_input,
    node_validate_investigation_result,
    node_validate_relationships,
)
from app.graph.state import PhantomWorkflowState

logger = logging.getLogger(__name__)


def build_phantom_graph():
    """
    Build and compile the PHANTOM LangGraph investigation workflow.

    Node sequence:
    load_dataset → validate_input → validate_relationships → build_timelines
    → detect_anomalies → create_investigation_cases → retrieve_case_evidence
    → single_agent_investigation → validate_investigation_result
    → calculate_evaluation_metrics → generate_final_report → END
    """
    graph = StateGraph(PhantomWorkflowState)

    # Add all nodes
    graph.add_node("load_dataset", node_load_dataset)
    graph.add_node("validate_input", node_validate_input)
    graph.add_node("validate_relationships", node_validate_relationships)
    graph.add_node("build_timelines", node_build_timelines)
    graph.add_node("detect_anomalies", node_detect_anomalies)
    graph.add_node("create_investigation_cases", node_create_investigation_cases)
    graph.add_node("retrieve_case_evidence", node_retrieve_case_evidence)
    graph.add_node("single_agent_investigation", node_single_agent_investigation)
    graph.add_node("validate_investigation_result", node_validate_investigation_result)
    graph.add_node("calculate_evaluation_metrics", node_calculate_evaluation_metrics)
    graph.add_node("generate_final_report", node_generate_final_report)

    # Set entry point
    graph.set_entry_point("load_dataset")

    # Sequential edges — no loops
    graph.add_edge("load_dataset", "validate_input")
    graph.add_edge("validate_input", "validate_relationships")
    graph.add_edge("validate_relationships", "build_timelines")
    graph.add_edge("build_timelines", "detect_anomalies")
    graph.add_edge("detect_anomalies", "create_investigation_cases")
    graph.add_edge("create_investigation_cases", "retrieve_case_evidence")
    graph.add_edge("retrieve_case_evidence", "single_agent_investigation")
    graph.add_edge("single_agent_investigation", "validate_investigation_result")
    graph.add_edge("validate_investigation_result", "calculate_evaluation_metrics")
    graph.add_edge("calculate_evaluation_metrics", "generate_final_report")
    graph.add_edge("generate_final_report", END)

    return graph.compile()


# Compiled graph singleton (lazy)
_compiled_graph = None


def get_phantom_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_phantom_graph()
    return _compiled_graph


def run_investigation(max_cases: int = 50) -> PhantomWorkflowState:
    """
    Run the full PHANTOM investigation workflow.
    Returns the final workflow state.
    """
    graph = get_phantom_graph()
    initial_state = PhantomWorkflowState(max_cases=max_cases)
    logger.info(f"Starting PHANTOM investigation run {initial_state.run_id}...")
    final_state = graph.invoke(initial_state)
    if isinstance(final_state, dict):
        final_state = PhantomWorkflowState(**final_state)
    logger.info(f"Investigation run {final_state.run_id} complete.")
    return final_state
