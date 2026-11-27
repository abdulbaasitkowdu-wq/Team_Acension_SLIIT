"""
PHANTOM — EvaluationMetrics Pydantic Model
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, model_validator


class EvaluationMetrics(BaseModel):
    """
    Classification and performance metrics for the investigation system.
    Fields are null when insufficient data or unavailable metadata.
    """

    # Classification counts (against ground-truth labels)
    true_positive: Optional[int] = Field(
        default=None,
        description="Correctly flagged fraudulent cases",
    )
    false_positive: Optional[int] = Field(
        default=None,
        description="Legitimate cases incorrectly flagged as suspicious",
    )
    true_negative: Optional[int] = Field(
        default=None,
        description="Correctly identified legitimate cases",
    )
    false_negative: Optional[int] = Field(
        default=None,
        description="Missed fraudulent cases (not flagged)",
    )

    # Derived metrics — computed from counts when available
    precision: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="TP / (TP + FP)",
    )
    recall: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="TP / (TP + FN)",
    )
    f1_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="2 × (Precision × Recall) / (Precision + Recall)",
    )
    false_positive_rate: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="FP / (FP + TN)",
    )

    # Case counts
    total_cases: int = Field(default=0, description="Total investigation cases created")
    investigated_cases: int = Field(
        default=0, description="Cases that completed agent investigation"
    )

    # Timing (seconds)
    average_investigation_time: Optional[float] = Field(
        default=None, description="Average seconds per case investigation"
    )
    total_execution_time: Optional[float] = Field(
        default=None, description="Total workflow execution time in seconds"
    )
    data_retrieval_time: Optional[float] = Field(
        default=None, description="Time spent on data retrieval (seconds)"
    )
    llm_inference_time: Optional[float] = Field(
        default=None, description="Time spent on LLM inference (seconds)"
    )

    # Token usage — from actual LLM provider metadata
    prompt_tokens: Optional[int] = Field(
        default=None, description="Total prompt tokens used (actual metadata)"
    )
    completion_tokens: Optional[int] = Field(
        default=None, description="Total completion tokens used (actual metadata)"
    )
    total_token_usage: Optional[int] = Field(
        default=None, description="prompt_tokens + completion_tokens"
    )
    token_usage_measured: bool = Field(
        default=False,
        description="True if token counts come from actual provider metadata; "
                    "False if unavailable or estimated",
    )

    # Cost
    estimated_inference_cost: Optional[float] = Field(
        default=None, description="Estimated USD cost based on provider pricing"
    )
    cost_note: Optional[str] = Field(
        default=None,
        description="Note on cost estimation method and accuracy",
    )

    @model_validator(mode="after")
    def compute_derived_metrics(self) -> "EvaluationMetrics":
        """Auto-compute precision/recall/F1/FPR if counts are available."""
        tp = self.true_positive
        fp = self.false_positive
        tn = self.true_negative
        fn = self.false_negative

        if tp is not None and fp is not None:
            denom = tp + fp
            self.precision = round(tp / denom, 6) if denom > 0 else None

        if tp is not None and fn is not None:
            denom = tp + fn
            self.recall = round(tp / denom, 6) if denom > 0 else None

        p = self.precision
        r = self.recall
        if p is not None and r is not None:
            denom = p + r
            self.f1_score = round(2 * p * r / denom, 6) if denom > 0 else None

        if fp is not None and tn is not None:
            denom = fp + tn
            self.false_positive_rate = round(fp / denom, 6) if denom > 0 else None

        if self.prompt_tokens is not None and self.completion_tokens is not None:
            self.total_token_usage = self.prompt_tokens + self.completion_tokens

        return self
