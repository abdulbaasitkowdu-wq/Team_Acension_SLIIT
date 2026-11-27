"""
PHANTOM — Anomaly Detector (Component D)
Implements deterministic anomaly screening based on actual dataset fields.
No LLM — pure Python logic.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from app.config.settings import settings
from app.models.case import AnomalyCategory, InvestigationCase, SeverityLevel

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    Deterministic anomaly detection across the pharmaceutical supply-chain dataset.
    Only checks supported by actual dataset fields are implemented.
    Uses pre-indexed lookups and groupby operations for O(N) performance on 1.2M+ rows.
    """

    def __init__(
        self,
        batches: pd.DataFrame,
        entities: pd.DataFrame,
        medicines: pd.DataFrame,
        fraud_events: pd.DataFrame,
        transactions: pd.DataFrame,
        config: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.batches = batches
        self.entities = entities
        self.medicines = medicines
        self.fraud_events = fraud_events
        self.transactions = transactions

        cfg = config or {}
        self.temp_excursion_threshold: float = cfg.get(
            "temp_excursion_threshold", settings.temp_excursion_rate_threshold
        )

        # Fast O(1) lookup dictionaries
        self._batch_med_map: Dict[str, str] = dict(
            zip(batches["batch_id"], batches["medicine_id"])
        )
        self._batch_mfr_map: Dict[str, str] = dict(
            zip(batches["batch_id"], batches["manufacturer_id"])
        )
        self._gt_map: Dict[str, Tuple[bool, Optional[str]]] = {
            bid: (
                bool(gt),
                str(ft) if pd.notna(ft) else None,
            )
            for bid, gt, ft in zip(
                fraud_events["batch_id"],
                fraud_events["is_fraud_ground_truth"],
                fraud_events["fraud_type"],
            )
        }

    def _get_batch_meta(self, batch_id: str) -> Tuple[List[str], List[str], Optional[bool], Optional[str]]:
        med = self._batch_med_map.get(batch_id)
        mfr = self._batch_mfr_map.get(batch_id)
        gt_info = self._gt_map.get(batch_id)
        gt_label = gt_info[0] if gt_info else None
        gt_fraud_type = gt_info[1] if gt_info else None
        return ([med] if med else [], [mfr] if mfr else [], gt_label, gt_fraud_type)

    # ------------------------------------------------------------------
    # Individual Anomaly Checks
    # ------------------------------------------------------------------

    def detect_duplicate_serials(self, limit: Optional[int] = None) -> List[InvestigationCase]:
        """
        Detect batches where duplicate_serial=True exists in transactions.
        Source: transactions.duplicate_serial
        """
        cases: List[InvestigationCase] = []
        if "duplicate_serial" not in self.transactions.columns:
            logger.warning("duplicate_serial column not found in transactions.")
            return cases

        dup_txs = self.transactions[self.transactions["duplicate_serial"] == True]
        if dup_txs.empty:
            return cases

        for batch_id, batch_dups in dup_txs.groupby("batch_id", sort=False):
            med_ids, entity_ids, gt_label, gt_fraud_type = self._get_batch_meta(str(batch_id))
            tx_refs = [
                f"{batch_id}|{et}|{idx}"
                for et, idx in zip(batch_dups["event_type"].head(20), batch_dups["batch_tx_index"].head(20))
            ]

            cases.append(
                InvestigationCase(
                    anomaly_category=AnomalyCategory.DUPLICATE_IDENTIFIER,
                    severity=SeverityLevel.HIGH,
                    description=(
                        f"Batch {batch_id} has {len(batch_dups)} transaction records "
                        f"with duplicate_serial=True, indicating potential duplicate "
                        f"serial number usage. This may indicate counterfeiting or "
                        f"data manipulation."
                    ),
                    transaction_ids=tx_refs,
                    batch_ids=[str(batch_id)],
                    medicine_ids=med_ids,
                    entity_ids=entity_ids,
                    detection_rule="duplicate_serial_flag",
                    detection_explanation=(
                        f"transactions.duplicate_serial=True detected for {len(batch_dups)} "
                        f"records in batch {batch_id}."
                    ),
                    evidence_references=[f"transactions:{ref}" for ref in tx_refs],
                    ground_truth_label=gt_label,
                    ground_truth_fraud_type=gt_fraud_type,
                )
            )
            if limit and len(cases) >= limit:
                break

        logger.info(f"detect_duplicate_serials: {len(cases)} cases")
        return cases

    def detect_temperature_excursions(self, limit: Optional[int] = None) -> List[InvestigationCase]:
        """
        Detect batches with high rolling_excursion_rate on cold-chain medicines.
        Source: transactions.rolling_excursion_rate + medicines.is_cold_chain
        """
        cases: List[InvestigationCase] = []
        if "rolling_excursion_rate" not in self.transactions.columns:
            return cases

        cold_chain_meds = set(
            self.medicines[self.medicines["is_cold_chain"] == True]["medicine_id"]
        )
        cold_chain_batches = {
            bid for bid, mid in self._batch_med_map.items() if mid in cold_chain_meds
        }
        if not cold_chain_batches:
            return cases

        # Filter high excursion rows first (much smaller than full 1.2M table)
        high_exc = self.transactions[
            (self.transactions["rolling_excursion_rate"] > self.temp_excursion_threshold)
            & (self.transactions["batch_id"].isin(cold_chain_batches))
        ]
        if high_exc.empty:
            return cases

        med_specs = self.medicines.set_index("medicine_id")[["storage_min", "storage_max"]].to_dict("index")

        for batch_id, batch_exc in high_exc.groupby("batch_id", sort=False):
            batch_id_str = str(batch_id)
            max_rate = float(batch_exc["rolling_excursion_rate"].max())
            med_ids, entity_ids, gt_label, gt_fraud_type = self._get_batch_meta(batch_id_str)
            med_id = med_ids[0] if med_ids else ""
            spec = med_specs.get(med_id, {})
            storage_min = int(spec["storage_min"]) if "storage_min" in spec else "N/A"
            storage_max = int(spec["storage_max"]) if "storage_max" in spec else "N/A"

            tx_refs = [
                f"{batch_id_str}|{et}|{idx}"
                for et, idx in zip(batch_exc["event_type"].head(10), batch_exc["batch_tx_index"].head(10))
            ]

            cases.append(
                InvestigationCase(
                    anomaly_category=AnomalyCategory.TEMPERATURE_EXCURSION,
                    severity=SeverityLevel.HIGH if max_rate > 0.5 else SeverityLevel.MEDIUM,
                    description=(
                        f"Cold-chain medicine {med_id} in batch {batch_id_str} has a maximum "
                        f"rolling temperature excursion rate of {max_rate:.2f} "
                        f"(threshold: {self.temp_excursion_threshold}). "
                        f"Required storage: {storage_min}°C–{storage_max}°C."
                    ),
                    transaction_ids=tx_refs,
                    batch_ids=[batch_id_str],
                    medicine_ids=med_ids,
                    entity_ids=entity_ids,
                    detection_rule="temperature_excursion_cold_chain",
                    detection_explanation=(
                        f"rolling_excursion_rate={max_rate:.4f} exceeds threshold "
                        f"{self.temp_excursion_threshold} for cold-chain medicine {med_id}."
                    ),
                    evidence_references=[f"transactions:{ref}" for ref in tx_refs],
                    ground_truth_label=gt_label,
                    ground_truth_fraud_type=gt_fraud_type,
                )
            )
            if limit and len(cases) >= limit:
                break

        logger.info(f"detect_temperature_excursions: {len(cases)} cases")
        return cases

    def detect_masked_transactions(self, limit: Optional[int] = None) -> List[InvestigationCase]:
        """
        Detect batches with is_masked=True transactions.
        Source: transactions.is_masked
        """
        cases: List[InvestigationCase] = []
        if "is_masked" not in self.transactions.columns:
            return cases

        masked = self.transactions[self.transactions["is_masked"] == True]
        if masked.empty:
            return cases

        for batch_id, batch_masked in masked.groupby("batch_id", sort=False):
            batch_id_str = str(batch_id)
            med_ids, entity_ids, gt_label, gt_fraud_type = self._get_batch_meta(batch_id_str)
            tx_refs = [
                f"{batch_id_str}|{et}|{idx}"
                for et, idx in zip(batch_masked["event_type"].head(20), batch_masked["batch_tx_index"].head(20))
            ]

            cases.append(
                InvestigationCase(
                    anomaly_category=AnomalyCategory.MASKED_TRANSACTION,
                    severity=SeverityLevel.MEDIUM,
                    description=(
                        f"Batch {batch_id_str} contains {len(batch_masked)} masked transaction "
                        f"records (is_masked=True). Masked transactions may indicate "
                        f"data obfuscation or recording discrepancies."
                    ),
                    transaction_ids=tx_refs,
                    batch_ids=[batch_id_str],
                    medicine_ids=med_ids,
                    entity_ids=entity_ids,
                    detection_rule="masked_transaction_flag",
                    detection_explanation=(
                        f"transactions.is_masked=True in {len(batch_masked)} records for batch {batch_id_str}."
                    ),
                    evidence_references=[f"transactions:{ref}" for ref in tx_refs],
                    ground_truth_label=gt_label,
                    ground_truth_fraud_type=gt_fraud_type,
                )
            )
            if limit and len(cases) >= limit:
                break

        logger.info(f"detect_masked_transactions: {len(cases)} cases")
        return cases

    def detect_authentication_failures(self, limit: Optional[int] = None) -> List[InvestigationCase]:
        """
        Detect batches where qr_verified=False or rfid_scanned=False or seal_intact=False.
        Source: transactions authentication columns.
        """
        cases: List[InvestigationCase] = []
        auth_cols = [
            c for c in ("qr_verified", "rfid_scanned", "seal_intact")
            if c in self.transactions.columns
        ]
        if not auth_cols:
            return cases

        fail_mask = pd.Series(False, index=self.transactions.index)
        for col in auth_cols:
            fail_mask = fail_mask | (self.transactions[col] == False)

        auth_failures = self.transactions[fail_mask]
        if auth_failures.empty:
            return cases

        batch_total_counts = self.transactions.groupby("batch_id", sort=False).size().to_dict()

        for batch_id, batch_fail in auth_failures.groupby("batch_id", sort=False):
            batch_id_str = str(batch_id)
            total_count = batch_total_counts.get(batch_id, len(batch_fail))
            failure_rate = len(batch_fail) / total_count if total_count > 0 else 0.0

            if failure_rate < 0.5:
                continue

            med_ids, entity_ids, gt_label, gt_fraud_type = self._get_batch_meta(batch_id_str)
            failed_checks = []
            for col in auth_cols:
                n_fail = int((batch_fail[col] == False).sum())
                if n_fail > 0:
                    failed_checks.append(f"{col}=False in {n_fail} records")

            tx_refs = [
                f"{batch_id_str}|{et}|{idx}"
                for et, idx in zip(batch_fail["event_type"].head(10), batch_fail["batch_tx_index"].head(10))
            ]

            cases.append(
                InvestigationCase(
                    anomaly_category=AnomalyCategory.AUTHENTICATION_FAILURE,
                    severity=SeverityLevel.HIGH,
                    description=(
                        f"Batch {batch_id_str} has authentication failures across "
                        f"{len(batch_fail)} of {total_count} records ({failure_rate:.0%}). "
                        f"Failed checks: {'; '.join(failed_checks)}."
                    ),
                    transaction_ids=tx_refs,
                    batch_ids=[batch_id_str],
                    medicine_ids=med_ids,
                    entity_ids=entity_ids,
                    detection_rule="authentication_failure_rate",
                    detection_explanation=(
                        f"Authentication failure rate {failure_rate:.2%} for batch {batch_id_str}. "
                        f"Failures: {', '.join(failed_checks)}."
                    ),
                    evidence_references=[f"transactions:{ref}" for ref in tx_refs],
                    ground_truth_label=gt_label,
                    ground_truth_fraud_type=gt_fraud_type,
                )
            )
            if limit and len(cases) >= limit:
                break

        logger.info(f"detect_authentication_failures: {len(cases)} cases")
        return cases

    def detect_inactive_entity_manufacturers(self, limit: Optional[int] = None) -> List[InvestigationCase]:
        """
        Detect batches manufactured by entities with non-active license_status.
        Source: batches.manufacturer_id + entities.license_status
        """
        cases: List[InvestigationCase] = []
        if "license_status" not in self.entities.columns:
            return cases

        inactive_df = self.entities[self.entities["license_status"] != "active"]
        if inactive_df.empty:
            return cases

        license_map = dict(zip(inactive_df["entity_id"], inactive_df["license_status"]))
        problem_batches = self.batches[self.batches["manufacturer_id"].isin(license_map)]

        for _, batch_row in problem_batches.iterrows():
            batch_id = str(batch_row["batch_id"])
            mfr_id = str(batch_row["manufacturer_id"])
            license_status = license_map.get(mfr_id, "unknown")
            gt_info = self._gt_map.get(batch_id)
            gt_label = gt_info[0] if gt_info else None
            gt_fraud_type = gt_info[1] if gt_info else None

            cases.append(
                InvestigationCase(
                    anomaly_category=AnomalyCategory.UNAUTHORIZED_ENTITY,
                    severity=SeverityLevel.HIGH,
                    description=(
                        f"Batch {batch_id} was manufactured by entity {mfr_id} "
                        f"whose license_status is '{license_status}' (not 'active'). "
                        f"Medicine: {batch_row['medicine_id']}."
                    ),
                    transaction_ids=[],
                    batch_ids=[batch_id],
                    medicine_ids=[str(batch_row["medicine_id"])],
                    entity_ids=[mfr_id],
                    detection_rule="inactive_manufacturer_license",
                    detection_explanation=(
                        f"entities.license_status='{license_status}' for manufacturer "
                        f"{mfr_id} associated with batch {batch_id}."
                    ),
                    evidence_references=[
                        f"batches:{batch_id}",
                        f"entities:{mfr_id}",
                    ],
                    ground_truth_label=gt_label,
                    ground_truth_fraud_type=gt_fraud_type,
                )
            )
            if limit and len(cases) >= limit:
                break

        logger.info(f"detect_inactive_entity_manufacturers: {len(cases)} cases")
        return cases

    def detect_fraud_detected_anomalies(self, limit: Optional[int] = None) -> List[InvestigationCase]:
        """
        Detect batches where is_fraud_detected=True in transactions.
        These are pre-detected flags from the existing pipeline — worth investigating.
        """
        cases: List[InvestigationCase] = []
        if "is_fraud_detected" not in self.transactions.columns:
            return cases

        detected = self.transactions[self.transactions["is_fraud_detected"] == True]
        if detected.empty:
            return cases

        for batch_id, batch_det in detected.groupby("batch_id", sort=False):
            batch_id_str = str(batch_id)
            med_ids, entity_ids, gt_label, gt_fraud_type = self._get_batch_meta(batch_id_str)
            tx_refs = [
                f"{batch_id_str}|{et}|{idx}"
                for et, idx in zip(batch_det["event_type"].head(20), batch_det["batch_tx_index"].head(20))
            ]

            cases.append(
                InvestigationCase(
                    anomaly_category=AnomalyCategory.COMPOSITE,
                    severity=SeverityLevel.HIGH,
                    description=(
                        f"Batch {batch_id_str} has {len(batch_det)} transaction records "
                        f"flagged as is_fraud_detected=True. "
                        f"Requires investigation to assess supporting evidence."
                    ),
                    transaction_ids=tx_refs,
                    batch_ids=[batch_id_str],
                    medicine_ids=med_ids,
                    entity_ids=entity_ids,
                    detection_rule="is_fraud_detected_flag",
                    detection_explanation=(
                        f"transactions.is_fraud_detected=True in {len(batch_det)} records "
                        f"for batch {batch_id_str}."
                    ),
                    evidence_references=[f"transactions:{ref}" for ref in tx_refs],
                    ground_truth_label=gt_label,
                    ground_truth_fraud_type=gt_fraud_type,
                )
            )
            if limit and len(cases) >= limit:
                break

        logger.info(f"detect_fraud_detected_anomalies: {len(cases)} cases")
        return cases

    # ------------------------------------------------------------------
    # Combined detection
    # ------------------------------------------------------------------

    def run_all_detectors(self, limit_per_rule: int = 25) -> List[InvestigationCase]:
        """
        Run all anomaly detectors and return a combined, deduplicated list of cases.
        limit_per_rule: max cases per detector (to prevent flooding the agent).
        """
        all_cases: List[InvestigationCase] = []

        detectors = [
            self.detect_fraud_detected_anomalies,
            self.detect_duplicate_serials,
            self.detect_temperature_excursions,
            self.detect_masked_transactions,
            self.detect_inactive_entity_manufacturers,
            self.detect_authentication_failures,
        ]

        for detector_fn in detectors:
            try:
                cases = detector_fn(limit=limit_per_rule)
                all_cases.extend(cases)
            except Exception as e:
                logger.error(f"Detector {detector_fn.__name__} failed: {e}")

        seen = set()
        deduped = []
        for case in all_cases:
            key = (tuple(sorted(case.batch_ids)), case.anomaly_category)
            if key not in seen:
                seen.add(key)
                deduped.append(case)

        logger.info(f"Total anomaly cases detected: {len(deduped)}")
        return deduped
