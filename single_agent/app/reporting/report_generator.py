"""
PHANTOM — Report Generator
Assembles final Pydantic-validated InvestigationReport for each case.
Saves reports as JSON to the outputs/ directory.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.data_processing.dataset_loader import DatasetStore
from app.models.assessment import AnomalyAssessment, InvestigationStatus
from app.models.case import AnomalyCategory, InvestigationCase, SeverityLevel
from app.models.evidence import EvidenceItem, EvidenceType, ValidationResult
from app.models.metrics import EvaluationMetrics
from app.models.report import (
    InvestigationReport,
    RelationalValidationSummary,
    ReportStatus,
    TimelineValidationSummary,
)
from app.models.timeline import BatchTimeline
from app.validation.timeline_validator import TimelineBuilder
from app.validation.relational_validator import RelationalValidator

logger = logging.getLogger(__name__)


class ReportGenerator:
    """
    Assembles structured InvestigationReport objects.
    All reports are JSON-serializable and React dashboard compatible.
    """

    def __init__(self, store: DatasetStore) -> None:
        self.store = store
        self.timeline_builder = TimelineBuilder()

    def generate_case_report(
        self,
        case: InvestigationCase,
        assessment: Optional[AnomalyAssessment],
        relational_summary: Dict[str, Any],
        metrics: Optional[EvaluationMetrics] = None,
    ) -> InvestigationReport:
        """Generate a full InvestigationReport for one case."""
        status = ReportStatus.COMPLETED if assessment else ReportStatus.PARTIAL

        # Build timeline
        batch_id = case.batch_ids[0] if case.batch_ids else None
        timeline = None
        if batch_id:
            try:
                batch_row = self.store.get_batch(batch_id)
                txs = self.store.get_batch_transactions(batch_id)
                timeline = self.timeline_builder.build_batch_timeline(batch_id, txs, batch_row)
            except Exception as e:
                logger.warning(f"Could not build timeline for {batch_id}: {e}")

        # Build relational validation summary for this case
        rel_summary = self._build_rel_summary(batch_id, relational_summary)

        # Build timeline validation summary
        tl_summary = self._build_timeline_summary(timeline)

        # Build evidence log
        evidence_log = self._build_evidence_log(case)

        # Final evaluation text
        final_eval = self._build_final_evaluation(case, assessment, timeline, evidence_log)

        # Limitations
        limitations = [
            "This system does not make legal or regulatory determinations.",
            "Assumes manufactured medicines are genuine products (MVP scope).",
            "Entity-level supply-chain tracking is limited — no entity_id in transaction records.",
            "Investigation evidence is derived exclusively from the preprocessed dataset.",
            "Missing timestamps or incomplete event chains may affect timeline accuracy.",
        ]
        if assessment and assessment.limitations:
            limitations.extend(assessment.limitations)

        report = InvestigationReport(
            case_id=case.case_id,
            investigation_status=status,
            case_details=case,
            targeted_entities=case.entity_ids,
            batch_ids=case.batch_ids,
            medicine_ids=case.medicine_ids,
            transaction_ids=case.transaction_ids[:20],
            anomaly_category=AnomalyCategory(case.anomaly_category),
            severity=SeverityLevel(case.severity),
            relational_validation_summary=rel_summary,
            chronological_timeline=timeline,
            timeline_validation_summary=tl_summary,
            evidence_log=evidence_log,
            anomaly_assessment=assessment,
            supporting_evidence=assessment.supporting_evidence if assessment else [],
            contradictory_evidence=assessment.contradictory_evidence if assessment else [],
            missing_information=assessment.missing_information if assessment else [],
            final_evaluation_result=final_eval,
            investigation_status_detail=(
                InvestigationStatus(assessment.investigation_status)
                if assessment else None
            ),
            recommended_human_review_actions=(
                assessment.recommended_human_review_actions if assessment else []
            ),
            limitations=limitations,
        )
        return report

    def _build_rel_summary(
        self, batch_id: Optional[str], relational_summary: Dict[str, Any]
    ) -> RelationalValidationSummary:
        """Build a relational validation summary for the report."""
        if not batch_id:
            return RelationalValidationSummary()

        try:
            validator = RelationalValidator(
                batches=self.store.batches,
                entities=self.store.entities,
                medicines=self.store.medicines,
                fraud_events=self.store.fraud_events,
                transactions=self.store.transactions,
            )
            result = validator.validate_batch(batch_id)
            return RelationalValidationSummary(
                total_checks=result.get("total_checks", 0),
                passed=result.get("passed", 0),
                failed=result.get("failed", 0),
                warnings=result.get("warnings", 0),
                details=result.get("results", []),
            )
        except Exception as e:
            logger.warning(f"Could not build relational summary for {batch_id}: {e}")
            return RelationalValidationSummary()

    def _build_timeline_summary(
        self, timeline: Optional[BatchTimeline]
    ) -> TimelineValidationSummary:
        if timeline is None:
            return TimelineValidationSummary()
        from app.models.timeline import TimelineStatus
        return TimelineValidationSummary(
            total_batches_checked=1,
            valid_timelines=1 if timeline.timeline_status == TimelineStatus.VALID else 0,
            invalid_timelines=0 if timeline.timeline_status == TimelineStatus.VALID else 1,
            missing_events_count=len(timeline.missing_events),
            chronological_violations=len(timeline.chronological_inconsistencies),
            details=timeline.chronological_inconsistencies + [f"Missing: {e}" for e in timeline.missing_events],
        )

    def _build_evidence_log(self, case: InvestigationCase) -> List[EvidenceItem]:
        """Collect structured EvidenceItem objects for the case."""
        items: List[EvidenceItem] = []

        for ref in case.evidence_references[:20]:
            # Parse reference format: "table:record_id"
            if ":" in ref:
                table, record_id = ref.split(":", 1)
            else:
                table, record_id = "unknown", ref

            ev_type_map = {
                "transactions": EvidenceType.TRANSACTION_RECORD,
                "batches": EvidenceType.BATCH_RECORD,
                "medicines": EvidenceType.MEDICINE_RECORD,
                "entities": EvidenceType.ENTITY_RECORD,
                "fraud_events": EvidenceType.FRAUD_EVENT_RECORD,
            }
            ev_type = ev_type_map.get(table, EvidenceType.COMPUTED_METRIC)

            item = EvidenceItem(
                source_dataset=table,
                source_record_id=record_id,
                evidence_type=ev_type,
                related_batch_id=case.batch_ids[0] if case.batch_ids else None,
                related_medicine_id=case.medicine_ids[0] if case.medicine_ids else None,
                related_entity_id=case.entity_ids[0] if case.entity_ids else None,
                evidence_description=(
                    f"Evidence record from {table} dataset for case {case.case_id}. "
                    f"Detection rule: {case.detection_rule}."
                ),
            )
            items.append(item)

        return items

    def _build_final_evaluation(
        self,
        case: InvestigationCase,
        assessment: Optional[AnomalyAssessment],
        timeline: Optional[BatchTimeline],
        evidence_log: List[EvidenceItem],
    ) -> str:
        """Build the narrative final evaluation text."""
        lines = []

        lines.append(f"PHANTOM Investigation Report — Case {case.case_id}")
        lines.append(f"Category: {case.anomaly_category} | Severity: {case.severity}")
        lines.append("")
        lines.append(f"WHAT WAS OBSERVED:")
        lines.append(case.description)
        lines.append("")

        if assessment:
            lines.append(f"INVESTIGATION STATUS: {assessment.investigation_status}")
            lines.append(f"Evidence Confidence: {assessment.confidence:.2f}")
            lines.append("")
            lines.append("ASSESSMENT SUMMARY:")
            lines.append(assessment.assessment_summary)
        else:
            lines.append("INVESTIGATION STATUS: Not completed — assessment unavailable.")

        if timeline:
            lines.append("")
            lines.append(f"TIMELINE STATUS: {timeline.timeline_status}")
            if timeline.chronological_inconsistencies:
                lines.append("Chronological issues found:")
                for issue in timeline.chronological_inconsistencies:
                    lines.append(f"  • {issue}")
            if timeline.missing_events:
                lines.append(f"Missing events: {', '.join(timeline.missing_events)}")

        lines.append("")
        lines.append("RECORD REFERENCES:")
        for ref in case.evidence_references[:10]:
            lines.append(f"  • {ref}")

        lines.append("")
        lines.append(
            "DISCLAIMER: This automated assessment is for investigative support only. "
            "It does not constitute a legal or regulatory determination. "
            "Human expert review is required before any action is taken."
        )

        return "\n".join(lines)

    def generate_all(
        self,
        cases: List[InvestigationCase],
        assessments: Dict[str, AnomalyAssessment],
        relational_summary: Dict[str, Any],
        metrics: Optional[EvaluationMetrics] = None,
    ) -> List[InvestigationReport]:
        """Generate reports for all investigation cases and save to outputs/."""
        reports = []
        output_dir = Path(settings_output_dir())
        output_dir.mkdir(parents=True, exist_ok=True)

        for case in cases:
            assessment = assessments.get(case.case_id)
            try:
                report = self.generate_case_report(
                    case=case,
                    assessment=assessment,
                    relational_summary=relational_summary,
                    metrics=metrics,
                )
                reports.append(report)

                # Save JSON
                out_path = output_dir / f"{report.report_id}.json"
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(report.to_dashboard_dict(), f, indent=2, default=str)
                logger.info(f"Report saved: {out_path}")
            except Exception as e:
                logger.error(f"Failed to generate report for case {case.case_id}: {e}")

        # Save run summary
        summary_path = output_dir / "run_summary.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "total_cases": len(cases),
                    "reports_generated": len(reports),
                    "metrics": metrics.model_dump(mode="json") if metrics else None,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                },
                f,
                indent=2,
                default=str,
            )

        return reports


def settings_output_dir() -> str:
    from app.config.settings import settings
    return settings.output_dir
