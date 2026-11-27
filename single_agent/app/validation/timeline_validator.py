"""
PHANTOM — Chronological Timeline Builder (Component C)
Reconstructs chronological event histories for batches.
Detects sequence violations, missing events, duplicates.
Deterministic Python logic only.
"""
from __future__ import annotations

import logging
from datetime import timezone
from typing import Any, Dict, List, Optional

import pandas as pd

from app.config.dataset_mapping import SUPPLY_CHAIN_SEQUENCE
from app.models.timeline import (
    BatchTimeline,
    TimelineEvent,
    TimelineEventType,
    TimelineStatus,
)

logger = logging.getLogger(__name__)


class TimelineBuilder:
    """
    Builds and validates chronological timelines for pharmaceutical batches.
    Uses supply-chain event sequence:
      manufacturing → quality_test → packaging → warehouse_in →
      shipment → distributor_receipt → pharmacy_receipt → sale
    """

    # Expected minimum time gap between consecutive events (seconds)
    MIN_EVENT_GAP_SECONDS = 0  # Allow same-second events (not physically impossible)

    def build_batch_timeline(
        self,
        batch_id: str,
        transactions: pd.DataFrame,
        batch_row: Optional[pd.Series] = None,
    ) -> BatchTimeline:
        """
        Build a full BatchTimeline for one batch from its transaction records.
        """
        medicine_id = batch_row["medicine_id"] if batch_row is not None else None
        manufacturer_id = batch_row["manufacturer_id"] if batch_row is not None else None

        # Sort transactions chronologically
        batch_txs = transactions.sort_values("timestamp", na_position="last")

        events: List[TimelineEvent] = []
        for _, row in batch_txs.iterrows():
            evt_type_str = row.get("event_type", "unknown")
            try:
                evt_type = TimelineEventType(evt_type_str)
            except ValueError:
                evt_type = TimelineEventType.UNKNOWN

            ts = row.get("timestamp")
            if pd.isna(ts):
                ts = None
            elif hasattr(ts, "tzinfo") and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)

            source_id = (
                f"{batch_id}|{evt_type_str}|{row.get('batch_tx_index', '?')}"
            )

            event = TimelineEvent(
                event_type=evt_type,
                timestamp=ts,
                entity_id=manufacturer_id if evt_type == TimelineEventType.MANUFACTURING else None,
                batch_id=batch_id,
                medicine_id=medicine_id,
                transaction_id=source_id,
                source_record_id=source_id,
                description=f"Batch {batch_id}: {evt_type_str} event",
                qr_verified=bool(row.get("qr_verified")) if "qr_verified" in row else None,
                rfid_scanned=bool(row.get("rfid_scanned")) if "rfid_scanned" in row else None,
                seal_intact=bool(row.get("seal_intact")) if "seal_intact" in row else None,
                temperature=float(row["temperature"]) if "temperature" in row and not pd.isna(row["temperature"]) else None,
                is_fraud_ground_truth=bool(row.get("is_fraud_ground_truth")) if "is_fraud_ground_truth" in row else None,
                fraud_type=str(row["fraud_type"]) if "fraud_type" in row and not pd.isna(row.get("fraud_type")) else None,
                duplicate_serial=bool(row.get("duplicate_serial")) if "duplicate_serial" in row else None,
            )
            events.append(event)

        timeline = BatchTimeline(
            batch_id=batch_id,
            medicine_id=medicine_id,
            manufacturer_id=manufacturer_id,
            events=events,
        )

        self._validate_timeline(timeline, batch_row)
        return timeline

    def _validate_timeline(
        self, timeline: BatchTimeline, batch_row: Optional[pd.Series]
    ) -> None:
        """
        Perform chronological validation in-place on a BatchTimeline.
        """
        events = timeline.events
        inconsistencies: List[str] = []
        missing_events: List[str] = []
        duplicate_events: List[str] = []
        any_violation = False

        # 1. Check for missing expected event types
        present_types = {e.event_type for e in events}
        for expected in SUPPLY_CHAIN_SEQUENCE:
            try:
                expected_type = TimelineEventType(expected)
            except ValueError:
                continue
            if expected_type not in present_types:
                missing_events.append(expected)

        # 2. Check for duplicate event types
        from collections import Counter
        type_counts = Counter(e.event_type for e in events)
        for etype, count in type_counts.items():
            if count > 1 and etype != TimelineEventType.UNKNOWN:
                duplicate_events.append(f"{etype} appears {count} times")

        # 3. Chronological order check
        timed_events = [e for e in events if e.timestamp is not None]
        for i in range(len(timed_events) - 1):
            curr = timed_events[i]
            nxt = timed_events[i + 1]
            if curr.timestamp > nxt.timestamp:
                msg = (
                    f"Chronological violation: {curr.event_type} at {curr.timestamp} "
                    f"occurs AFTER {nxt.event_type} at {nxt.timestamp} "
                    f"(records: {curr.source_record_id}, {nxt.source_record_id})"
                )
                inconsistencies.append(msg)
                curr.status = TimelineStatus.CHRONOLOGICAL_VIOLATION
                any_violation = True

        # 4. Check production_date vs first transaction timestamp
        if batch_row is not None and timed_events:
            prod_date = batch_row.get("production_date")
            first_ts = timed_events[0].timestamp
            if prod_date is not None and not pd.isna(prod_date):
                if hasattr(prod_date, "tzinfo") and prod_date.tzinfo is None:
                    prod_date = prod_date.replace(tzinfo=timezone.utc)
                if first_ts < prod_date:
                    msg = (
                        f"Transaction at {first_ts} occurs before batch production_date {prod_date}. "
                        f"Record: {timed_events[0].source_record_id}"
                    )
                    inconsistencies.append(msg)
                    timed_events[0].status = TimelineStatus.CHRONOLOGICAL_VIOLATION
                    any_violation = True

        # Set missing timestamps
        for e in events:
            if e.timestamp is None:
                e.status = TimelineStatus.MISSING_TIMESTAMP

        timeline.chronological_inconsistencies = inconsistencies
        timeline.missing_events = missing_events
        timeline.duplicate_events = duplicate_events

        if any_violation:
            timeline.timeline_status = TimelineStatus.CHRONOLOGICAL_VIOLATION
        elif missing_events:
            timeline.timeline_status = TimelineStatus.MISSING_EVENT
        else:
            timeline.timeline_status = TimelineStatus.VALID

    def build_multiple(
        self,
        batch_ids: List[str],
        all_transactions: pd.DataFrame,
        batches: pd.DataFrame,
    ) -> Dict[str, BatchTimeline]:
        """Build timelines for multiple batches efficiently."""
        results: Dict[str, BatchTimeline] = {}
        batches_idx = batches.set_index("batch_id")

        for batch_id in batch_ids:
            try:
                # Get transactions for this batch
                try:
                    tx = all_transactions.loc[[batch_id]].sort_values("timestamp")
                except KeyError:
                    tx = pd.DataFrame()

                batch_row = batches_idx.loc[batch_id] if batch_id in batches_idx.index else None
                timeline = self.build_batch_timeline(batch_id, tx, batch_row)
                results[batch_id] = timeline
            except Exception as e:
                logger.error(f"Error building timeline for {batch_id}: {e}")
                results[batch_id] = BatchTimeline(
                    batch_id=batch_id,
                    timeline_status=TimelineStatus.MISSING_EVENT,
                    chronological_inconsistencies=[f"Error: {str(e)}"],
                )

        return results
