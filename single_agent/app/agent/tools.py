"""
PHANTOM — Evidence Retrieval Tools
Deterministic tools used by the single investigation agent.
All tools retrieve actual dataset records — no fabricated data.
"""
from __future__ import annotations

import logging
from datetime import timezone
from typing import Any, Dict, List, Optional

import pandas as pd

from app.data_processing.dataset_loader import DatasetStore
from app.models.evidence import EvidenceItem, EvidenceType, ValidationResult

logger = logging.getLogger(__name__)


class EvidenceTools:
    """
    Deterministic evidence retrieval tools for the investigation agent.
    Returns structured dicts suitable for LLM context (not full DataFrames).
    Max records per call is capped to avoid flooding LLM context.
    """

    MAX_RECORDS = 20  # Maximum records to return per tool call
    GROUND_TRUTH_COLUMNS = {"is_fraud_ground_truth", "fraud_type", "in_ring"}

    def __init__(self, store: DatasetStore) -> None:
        self.store = store

    def _safe_val(self, v: Any) -> Any:
        """Convert pandas NA/NaT/NaN to None for JSON safety."""
        if pd.isna(v) if not isinstance(v, (list, dict)) else False:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        if hasattr(v, "item"):
            return v.item()
        return v

    def _series_to_dict(self, s: pd.Series) -> Dict[str, Any]:
        return {
            k: self._safe_val(v)
            for k, v in s.items()
            if k not in self.GROUND_TRUTH_COLUMNS
        }

    # ------------------------------------------------------------------
    # Core retrieval tools
    # ------------------------------------------------------------------

    def get_batch_records(self, batch_id: str) -> Dict[str, Any]:
        """Retrieve batch record for a given batch_id."""
        row = self.store.get_batch(batch_id)
        if row is None:
            return {"found": False, "batch_id": batch_id, "error": "Batch not found"}
        return {
            "found": True,
            "source": "batches",
            "batch_id": batch_id,
            "data": self._series_to_dict(row),
        }

    def get_medicine_records(self, medicine_id: str) -> Dict[str, Any]:
        """Retrieve medicine specifications for a given medicine_id."""
        row = self.store.get_medicine(medicine_id)
        if row is None:
            return {"found": False, "medicine_id": medicine_id, "error": "Medicine not found"}
        return {
            "found": True,
            "source": "medicines",
            "medicine_id": medicine_id,
            "data": self._series_to_dict(row),
        }

    def get_entity_records(self, entity_id: str) -> Dict[str, Any]:
        """Retrieve entity records for a given entity_id."""
        row = self.store.get_entity(entity_id)
        if row is None:
            return {"found": False, "entity_id": entity_id, "error": "Entity not found"}
        return {
            "found": True,
            "source": "entities",
            "entity_id": entity_id,
            "data": self._series_to_dict(row),
        }

    def get_transaction_records(self, transaction_id: str) -> Dict[str, Any]:
        """
        Retrieve a specific transaction record by composite transaction_id
        (format: batch_id|event_type|batch_tx_index).
        """
        parts = transaction_id.split("|")
        if len(parts) != 3:
            return {"found": False, "transaction_id": transaction_id, "error": "Invalid transaction_id format (expected batch_id|event_type|batch_tx_index)"}
        batch_id, event_type, batch_tx_idx = parts

        try:
            batch_txs = self.store.transactions.loc[[batch_id]]
        except KeyError:
            return {"found": False, "transaction_id": transaction_id, "error": f"Batch {batch_id} not found"}

        matches = batch_txs[
            (batch_txs["event_type"] == event_type)
            & (batch_txs["batch_tx_index"].astype(str) == batch_tx_idx)
        ]
        if matches.empty:
            return {"found": False, "transaction_id": transaction_id, "error": "Transaction record not found"}

        row = matches.iloc[0]
        return {
            "found": True,
            "source": "transactions",
            "transaction_id": transaction_id,
            "data": self._series_to_dict(row),
        }

    def get_related_transactions(self, batch_id: str) -> Dict[str, Any]:
        """Return all transactions for a given batch_id (capped at MAX_RECORDS)."""
        txs = self.store.get_batch_transactions(batch_id)
        if txs.empty:
            return {"found": False, "batch_id": batch_id, "count": 0, "records": []}

        records = [
            self._series_to_dict(row)
            for _, row in txs.head(self.MAX_RECORDS).iterrows()
        ]

        return {
            "found": True,
            "source": "transactions",
            "batch_id": batch_id,
            "count": len(txs),
            "returned": len(records),
            "records": records,
        }

    def get_batch_timeline(self, batch_id: str) -> Dict[str, Any]:
        """
        Return ordered timeline events for a batch (manufacturing → sale).
        """
        from app.validation.timeline_validator import TimelineBuilder
        batch_row = self.store.get_batch(batch_id)
        txs = self.store.get_batch_transactions(batch_id)

        builder = TimelineBuilder()
        timeline = builder.build_batch_timeline(batch_id, txs, batch_row)

        events_data = []
        for evt in timeline.events:
            events_data.append({
                "event_type": evt.event_type,
                "timestamp": evt.timestamp.isoformat() if evt.timestamp else None,
                "status": evt.status,
                "source_record_id": evt.source_record_id,
                "qr_verified": evt.qr_verified,
                "rfid_scanned": evt.rfid_scanned,
                "seal_intact": evt.seal_intact,
                "temperature": evt.temperature,
                "duplicate_serial": evt.duplicate_serial,
            })

        return {
            "batch_id": batch_id,
            "medicine_id": timeline.medicine_id,
            "manufacturer_id": timeline.manufacturer_id,
            "timeline_status": timeline.timeline_status,
            "total_events": len(events_data),
            "events": events_data,
            "chronological_inconsistencies": timeline.chronological_inconsistencies,
            "missing_events": timeline.missing_events,
            "duplicate_events": timeline.duplicate_events,
        }

    def validate_batch_relationships(self, batch_id: str) -> Dict[str, Any]:
        """Run relational integrity validation for a batch."""
        from app.validation.relational_validator import RelationalValidator
        validator = RelationalValidator(
            batches=self.store.batches,
            entities=self.store.entities,
            medicines=self.store.medicines,
            fraud_events=self.store.fraud_events,
            transactions=self.store.transactions,
        )
        return validator.validate_batch(batch_id)

    def get_fraud_event(self, batch_id: str) -> Dict[str, Any]:
        """Return the fraud_events record for a given batch_id (ground truth)."""
        row = self.store.get_fraud_event(batch_id)
        if row is None:
            return {"found": False, "batch_id": batch_id, "error": "No fraud_event record found"}
        return {
            "found": True,
            "source": "fraud_events",
            "batch_id": batch_id,
            "data": self._series_to_dict(row),
        }

    def get_anomaly_evidence(self, case: "InvestigationCase") -> List[Dict[str, Any]]:
        """
        Collect all evidence items for a given investigation case.
        Returns a list of raw data dicts from each evidence reference.
        """
        evidence_items = []

        for batch_id in case.batch_ids:
            # Batch record
            evidence_items.append({
                "source": "batches",
                "record_id": batch_id,
                "data": self.get_batch_records(batch_id),
            })
            # Timeline
            evidence_items.append({
                "source": "batch_timeline",
                "record_id": batch_id,
                "data": self.get_batch_timeline(batch_id),
            })
            # Transactions (summarized)
            evidence_items.append({
                "source": "transactions",
                "record_id": batch_id,
                "data": self.get_related_transactions(batch_id),
            })
            # Relational validation
            evidence_items.append({
                "source": "relational_validation",
                "record_id": batch_id,
                "data": self.validate_batch_relationships(batch_id),
            })

        for med_id in case.medicine_ids:
            evidence_items.append({
                "source": "medicines",
                "record_id": med_id,
                "data": self.get_medicine_records(med_id),
            })

        for entity_id in case.entity_ids:
            evidence_items.append({
                "source": "entities",
                "record_id": entity_id,
                "data": self.get_entity_records(entity_id),
            })

        return evidence_items

    def summarize_evidence_for_llm(
        self, case: "InvestigationCase", max_chars: int = 8000
    ) -> str:
        """
        Return a compact, text-formatted evidence summary for the LLM context.
        Caps total character length to avoid context overflow.
        """
        lines = []
        lines.append(f"=== CASE: {case.case_id} ===")
        lines.append(f"Category: {case.anomaly_category}")
        lines.append(f"Severity: {case.severity}")
        lines.append(f"Description: {case.description}")
        lines.append(f"Detection Rule: {case.detection_rule}")
        lines.append(f"Detection Explanation: {case.detection_explanation}")
        lines.append("")

        import json

        evidence_items = self.get_anomaly_evidence(case)
        for item in evidence_items:
            header = f"--- SOURCE: {item['source']} | RECORD: {item['record_id']} ---"
            lines.append(header)
            try:
                data_str = json.dumps(item["data"], indent=2, default=str)
                # Truncate long data blocks
                if len(data_str) > 1500:
                    data_str = data_str[:1500] + "\n... [truncated for context length]"
                lines.append(data_str)
            except Exception:
                lines.append(str(item["data"])[:500])
            lines.append("")

        full_text = "\n".join(lines)
        if len(full_text) > max_chars:
            full_text = full_text[:max_chars] + "\n... [evidence truncated — context limit reached]"
        return full_text
