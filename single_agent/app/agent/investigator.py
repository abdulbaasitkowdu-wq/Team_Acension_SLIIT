"""
PHANTOM — Single Investigation Agent
One AI reasoning agent using LangChain + configurable LLM.
Investigates pharmaceutical supply-chain anomaly cases using evidence from deterministic tools.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional, Tuple

from app.agent.prompts import INVESTIGATION_PROMPT_TEMPLATE, SYSTEM_PROMPT
from app.agent.tools import EvidenceTools
from app.config.settings import settings
from app.data_processing.dataset_loader import DatasetStore
from app.models.assessment import AnomalyAssessment, InvestigationStatus
from app.models.case import InvestigationCase

logger = logging.getLogger(__name__)


def build_llm():
    """
    Build the LLM client based on configured provider.
    Returns a LangChain chat model.
    """
    provider = settings.llm_provider
    kwargs = settings.get_llm_kwargs()

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(**kwargs)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(**kwargs)
    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(**kwargs)
    elif provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(**kwargs)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


class PhantomInvestigationAgent:
    """
    Single AI investigation agent for PHANTOM.
    Uses one bounded investigation pass per case.
    No multi-agent communication. No debate loops.
    """

    def __init__(self, store: DatasetStore) -> None:
        self.store = store
        self.tools = EvidenceTools(store)
        self._llm = None  # Lazy initialization

    @property
    def llm(self):
        if self._llm is None:
            self._llm = build_llm()
        return self._llm

    def investigate_case(
        self, case: InvestigationCase
    ) -> Tuple[Optional[AnomalyAssessment], Dict[str, Any]]:
        """
        Investigate a single anomaly case in one bounded reasoning pass.

        Returns:
            (AnomalyAssessment, usage_metadata) tuple.
            usage_metadata contains token counts if available.
        """
        from langchain_core.messages import HumanMessage, SystemMessage

        start_time = time.time()
        usage_metadata: Dict[str, Any] = {
            "prompt_tokens": None,
            "completion_tokens": None,
            "total_tokens": None,
            "measured": False,
            "investigation_time": None,
        }

        try:
            # 1. Collect evidence deterministically (no LLM)
            evidence_summary = self.tools.summarize_evidence_for_llm(case)

            # 2. Build investigation prompt
            human_content = INVESTIGATION_PROMPT_TEMPLATE.format(
                evidence_summary=evidence_summary
            )

            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=human_content),
            ]

            # 3. Single LLM inference pass
            logger.info(f"Invoking LLM for case {case.case_id}...")
            response = self.llm.invoke(messages)

            # 4. Extract token usage from actual provider metadata
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                meta = response.usage_metadata
                usage_metadata["prompt_tokens"] = getattr(meta, "input_tokens", None)
                usage_metadata["completion_tokens"] = getattr(meta, "output_tokens", None)
                if usage_metadata["prompt_tokens"] and usage_metadata["completion_tokens"]:
                    usage_metadata["total_tokens"] = (
                        usage_metadata["prompt_tokens"] + usage_metadata["completion_tokens"]
                    )
                    usage_metadata["measured"] = True
            elif hasattr(response, "response_metadata"):
                meta = response.response_metadata
                token_usage = meta.get("token_usage") or meta.get("usage", {})
                if token_usage:
                    usage_metadata["prompt_tokens"] = token_usage.get("prompt_tokens")
                    usage_metadata["completion_tokens"] = token_usage.get("completion_tokens")
                    total = token_usage.get("total_tokens")
                    if total:
                        usage_metadata["total_tokens"] = total
                        usage_metadata["measured"] = True

            # 5. Parse structured JSON output
            content = response.content
            # Strip markdown code fences if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            raw_data = json.loads(content)
            assessment = AnomalyAssessment(**raw_data)

            elapsed = time.time() - start_time
            usage_metadata["investigation_time"] = round(elapsed, 3)
            logger.info(
                f"Case {case.case_id} investigation complete in {elapsed:.2f}s. "
                f"Status: {assessment.investigation_status}"
            )
            return assessment, usage_metadata

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response for case {case.case_id}: {e}")
            # Return a minimal inconclusive assessment on parse failure
            assessment = AnomalyAssessment(
                anomaly_detected=False,
                anomaly_category=case.anomaly_category,
                severity=case.severity,
                factual_observations=[
                    f"Case {case.case_id}: LLM response could not be parsed as valid JSON."
                ],
                supporting_evidence=[],
                contradictory_evidence=[],
                possible_explanations=["LLM output format error — results unreliable."],
                missing_information=["Structured LLM response unavailable."],
                confidence=0.0,
                investigation_status=InvestigationStatus.INSUFFICIENT_EVIDENCE,
                assessment_summary=(
                    f"Investigation of case {case.case_id} failed due to a JSON parsing error "
                    f"in the LLM response. The raw evidence was collected but could not be "
                    f"structured into a valid assessment. Human review is required."
                ),
                recommended_human_review_actions=["Manually review raw evidence for this case."],
                limitations=["Automated investigation failed due to output format error."],
            )
            elapsed = time.time() - start_time
            usage_metadata["investigation_time"] = round(elapsed, 3)
            return assessment, usage_metadata

        except Exception as e:
            logger.error(f"Investigation failed for case {case.case_id}: {e}", exc_info=True)
            elapsed = time.time() - start_time
            usage_metadata["investigation_time"] = round(elapsed, 3)
            return None, usage_metadata
