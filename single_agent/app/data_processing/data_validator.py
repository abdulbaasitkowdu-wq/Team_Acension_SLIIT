"""
PHANTOM — Data Validator
Validates dataset integrity before investigation begins.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

import pandas as pd

logger = logging.getLogger(__name__)


class DataValidator:
    """
    Validates basic data integrity constraints across all loaded datasets.
    Deterministic Python logic — no LLM involved.
    """

    def validate_batches(self, batches: pd.DataFrame) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if batches.empty:
            errors.append("Batches table is empty.")
            return False, errors

        # Check for duplicate batch_ids
        dups = batches[batches["batch_id"].duplicated(keep=False)]
        if not dups.empty:
            errors.append(
                f"Found {len(dups)} duplicate batch_id rows in batches table."
            )

        # Check production_date < expiry_date
        if "production_date" in batches.columns and "expiry_date" in batches.columns:
            invalid_dates = batches[
                pd.to_datetime(batches["production_date"], errors="coerce")
                >= pd.to_datetime(batches["expiry_date"], errors="coerce")
            ]
            if not invalid_dates.empty:
                errors.append(
                    f"{len(invalid_dates)} batches have production_date >= expiry_date."
                )

        # Check quantity > 0
        if "quantity" in batches.columns:
            zero_qty = batches[batches["quantity"] <= 0]
            if not zero_qty.empty:
                errors.append(
                    f"{len(zero_qty)} batches have quantity <= 0."
                )

        return len(errors) == 0, errors

    def validate_entities(self, entities: pd.DataFrame) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if entities.empty:
            errors.append("Entities table is empty.")
            return False, errors

        dups = entities[entities["entity_id"].duplicated(keep=False)]
        if not dups.empty:
            errors.append(
                f"Found {len(dups)} duplicate entity_id rows in entities table."
            )

        return len(errors) == 0, errors

    def validate_medicines(self, medicines: pd.DataFrame) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if medicines.empty:
            errors.append("Medicines table is empty.")
            return False, errors

        dups = medicines[medicines["medicine_id"].duplicated(keep=False)]
        if not dups.empty:
            errors.append(
                f"Found {len(dups)} duplicate medicine_id rows in medicines table."
            )

        return len(errors) == 0, errors

    def validate_transactions(
        self, transactions: pd.DataFrame
    ) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if transactions.empty:
            errors.append("Transactions table is empty.")
            return False, errors

        # Null timestamps
        null_ts = transactions["timestamp"].isnull().sum()
        if null_ts > 0:
            errors.append(f"{null_ts} transactions have null timestamps.")

        return len(errors) == 0, errors

    def validate_cross_references(
        self,
        batches: pd.DataFrame,
        entities: pd.DataFrame,
        medicines: pd.DataFrame,
        transactions: pd.DataFrame,
    ) -> Tuple[bool, List[str]]:
        errors: List[str] = []

        # batches.medicine_id must exist in medicines.medicine_id
        valid_medicines = set(medicines["medicine_id"])
        invalid_med = batches[~batches["medicine_id"].isin(valid_medicines)]
        if not invalid_med.empty:
            errors.append(
                f"{len(invalid_med)} batches reference non-existent medicine_ids."
            )

        # batches.manufacturer_id must exist in entities.entity_id
        valid_entities = set(entities["entity_id"])
        invalid_mfr = batches[~batches["manufacturer_id"].isin(valid_entities)]
        if not invalid_mfr.empty:
            errors.append(
                f"{len(invalid_mfr)} batches reference non-existent manufacturer_ids "
                f"(entity_id). First 5: {list(invalid_mfr['manufacturer_id'].head())}. "
                "Note: This is expected if entity types are filtered by entity_type."
            )

        # transactions.batch_id must exist in batches.batch_id
        valid_batches = set(batches["batch_id"])
        # Use the original column before reindexing
        tx_batch_ids = (
            transactions["batch_id"]
            if "batch_id" in transactions.columns
            else transactions.index
        )
        orphan_tx = tx_batch_ids[~tx_batch_ids.isin(valid_batches)]
        if not orphan_tx.empty:
            errors.append(
                f"{orphan_tx.nunique()} unique transaction batch_ids not found in batches table."
            )

        return len(errors) == 0, errors

    def run_all_validations(
        self,
        batches: pd.DataFrame,
        entities: pd.DataFrame,
        medicines: pd.DataFrame,
        transactions: pd.DataFrame,
    ) -> Dict[str, Any]:
        """Run all validations and return a combined result dict."""
        results: Dict[str, Any] = {}
        all_ok = True

        for name, fn, args in [
            ("batches", self.validate_batches, (batches,)),
            ("entities", self.validate_entities, (entities,)),
            ("medicines", self.validate_medicines, (medicines,)),
            ("transactions", self.validate_transactions, (transactions,)),
            (
                "cross_references",
                self.validate_cross_references,
                (batches, entities, medicines, transactions),
            ),
        ]:
            ok, errors = fn(*args)
            results[name] = {"valid": ok, "errors": errors}
            if not ok:
                all_ok = False
                for e in errors:
                    logger.warning(f"Validation [{name}]: {e}")

        results["_overall_valid"] = all_ok
        return results
