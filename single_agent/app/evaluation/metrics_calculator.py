"""
PHANTOM — Evaluation Metrics Calculator
Computes precision, recall, F1, FPR from investigation results vs ground-truth labels.
Uses original dataset labels — never agent conclusions as ground truth.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.models.assessment import AnomalyAssessment, InvestigationStatus
from app.models.case import InvestigationCase
from app.models.metrics import EvaluationMetrics

logger = logging.getLogger(__name__)


class MetricsCalculator:
    """
    Calculates classification metrics for the investigation system.

    Ground truth: case.ground_truth_label (from fraud_events.is_fraud_ground_truth)
    Predicted positive: assessment.anomaly_detected == True

    IMPORTANT: Only cases with non-null ground_truth_label contribute to metrics.
    Cases without ground truth are excluded from metric calculations.
    Metrics for anomaly detection (rule-based) vs investigation assessment are separate.
    """

    def calculate(
        self,
        cases: List[InvestigationCase],
        assessments: Dict[str, AnomalyAssessment],
        usage_metadata: Dict[str, Any],
    ) -> EvaluationMetrics:
        """Calculate all evaluation metrics."""
        total_cases = len(cases)
        investigated_cases = len(assessments)

        # --- Classification metrics (agent assessment vs ground truth) ---
        tp = fp = tn = fn = 0
        evaluable = 0

        for case in cases:
            gt = case.ground_truth_label
            if gt is None:
                continue  # No ground truth — skip

            assessment = assessments.get(case.case_id)
            if assessment is None:
                # Not investigated — treat as negative prediction
                predicted_positive = False
            else:
                predicted_positive = assessment.anomaly_detected

            evaluable += 1
            if gt and predicted_positive:
                tp += 1
            elif gt and not predicted_positive:
                fn += 1
            elif not gt and predicted_positive:
                fp += 1
            elif not gt and not predicted_positive:
                tn += 1

        # --- Token usage aggregation ---
        total_prompt = total_completion = None
        any_measured = False

        for case_id, usage in usage_metadata.items():
            if usage.get("measured"):
                any_measured = True
                pt = usage.get("prompt_tokens", 0) or 0
                ct = usage.get("completion_tokens", 0) or 0
                total_prompt = (total_prompt or 0) + pt
                total_completion = (total_completion or 0) + ct

        # --- Timing ---
        inv_times = []
        for case_id, usage in usage_metadata.items():
            t = usage.get("investigation_time")
            if t is not None:
                inv_times.append(t)

        avg_time = round(sum(inv_times) / len(inv_times), 3) if inv_times else None

        # --- Cost estimation (approximate — clearly labeled as estimate) ---
        estimated_cost = None
        cost_note = None
        if any_measured and total_prompt and total_completion:
            # Using gpt-4o-mini pricing as default estimate (clearly labeled)
            cost_per_1k_prompt = 0.00015
            cost_per_1k_completion = 0.00060
            estimated_cost = round(
                (total_prompt / 1000 * cost_per_1k_prompt)
                + (total_completion / 1000 * cost_per_1k_completion),
                6,
            )
            cost_note = (
                f"Estimated based on GPT-4o-mini pricing "
                f"(${cost_per_1k_prompt}/1K prompt tokens, ${cost_per_1k_completion}/1K completion tokens). "
                f"Actual cost depends on the configured provider and model."
            )

        # --- Build metrics ---
        metrics = EvaluationMetrics(
            true_positive=tp if evaluable > 0 else None,
            false_positive=fp if evaluable > 0 else None,
            true_negative=tn if evaluable > 0 else None,
            false_negative=fn if evaluable > 0 else None,
            total_cases=total_cases,
            investigated_cases=investigated_cases,
            average_investigation_time=avg_time,
            prompt_tokens=total_prompt,
            completion_tokens=total_completion,
            token_usage_measured=any_measured,
            estimated_inference_cost=estimated_cost,
            cost_note=cost_note,
        )
        # Pydantic model_validator auto-computes precision/recall/F1/FPR
        return metrics
