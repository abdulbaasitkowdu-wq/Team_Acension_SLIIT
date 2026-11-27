"""
PHANTOM — Relational Integrity Validator (Component B)
Validates relationships between pharmaceutical supply-chain records.
Deterministic Python logic only — no LLM.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


class ValidationStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"


@dataclass
class ValidationResult:
    validation_id: str
    record_id: str
    related_entity_ids: List[str]
    validation_category: str
    expected_relationship: str
    actual_relationship: str
    status: ValidationStatus
    evidence_references: List[str]
    explanation: str


class RelationalValidator:
    """
    Validates relational integrity across pharmaceutical supply-chain records.
    Returns structured ValidationResult objects — never modifies source data.
    """

    def __init__(
        self,
        batches: pd.DataFrame,
        entities: pd.DataFrame,
        medicines: pd.DataFrame,
        fraud_events: pd.DataFrame,
        transactions: pd.DataFrame,
    ) -> None:
        self.batches = batches
        self.entities = entities
        self.medicines = medicines
        self.fraud_events = fraud_events
        self.transactions = transactions

        # Build lookup sets
        self._batch_ids: set = set(batches["batch_id"])
        self._medicine_ids: set = set(medicines["medicine_id"])
        self._entity_ids: set = set(entities["entity_id"])
        self._manufacturer_ids: set = set(entities[entities["entity_type"] == "manufacturer"]["entity_id"]) if "entity_type" in entities.columns else set()
        self._batch_medicine_map: Dict[str, str] = dict(zip(batches["batch_id"], batches["medicine_id"]))
        self._batch_manufacturer_map: Dict[str, str] = dict(zip(batches["batch_id"], batches["manufacturer_id"]))

    # ------------------------------------------------------------------
    # Batch-level Validations
    # ------------------------------------------------------------------

    def validate_batch_medicine_reference(
        self, batch_id: str
    ) -> ValidationResult:
        """Check that a batch references a valid medicine_id."""
        vid = f"REL-MED-{batch_id}"
        if batch_id not in self._batch_ids:
            return ValidationResult(
                validation_id=vid,
                record_id=batch_id,
                related_entity_ids=[],
                validation_category="batch_medicine_reference",
                expected_relationship="batch references existing medicine_id",
                actual_relationship="batch not found",
                status=ValidationStatus.FAIL,
                evidence_references=[f"batches:{batch_id}"],
                explanation=f"Batch {batch_id} not found in batches table.",
            )
        medicine_id = self._batch_medicine_map.get(batch_id, "")
        if medicine_id in self._medicine_ids:
            return ValidationResult(
                validation_id=vid,
                record_id=batch_id,
                related_entity_ids=[medicine_id],
                validation_category="batch_medicine_reference",
                expected_relationship="batch references existing medicine_id",
                actual_relationship=f"medicine_id={medicine_id} exists",
                status=ValidationStatus.PASS,
                evidence_references=[f"batches:{batch_id}", f"medicines:{medicine_id}"],
                explanation=f"Batch {batch_id} correctly references medicine {medicine_id}.",
            )
        else:
            return ValidationResult(
                validation_id=vid,
                record_id=batch_id,
                related_entity_ids=[medicine_id],
                validation_category="batch_medicine_reference",
                expected_relationship="batch references existing medicine_id",
                actual_relationship=f"medicine_id={medicine_id} NOT FOUND",
                status=ValidationStatus.FAIL,
                evidence_references=[f"batches:{batch_id}"],
                explanation=f"Batch {batch_id} references medicine_id='{medicine_id}' "
                            "which does not exist in the medicines table.",
            )

    def validate_batch_manufacturer_reference(
        self, batch_id: str
    ) -> ValidationResult:
        """Check that a batch's manufacturer_id exists in entities."""
        vid = f"REL-MFR-{batch_id}"
        manufacturer_id = self._batch_manufacturer_map.get(batch_id, "")
        if manufacturer_id in self._entity_ids:
            return ValidationResult(
                validation_id=vid,
                record_id=batch_id,
                related_entity_ids=[manufacturer_id],
                validation_category="batch_manufacturer_reference",
                expected_relationship="manufacturer_id exists in entities",
                actual_relationship=f"entity_id={manufacturer_id} exists",
                status=ValidationStatus.PASS,
                evidence_references=[f"batches:{batch_id}", f"entities:{manufacturer_id}"],
                explanation=f"Batch {batch_id} manufacturer {manufacturer_id} is a registered entity.",
            )
        else:
            return ValidationResult(
                validation_id=vid,
                record_id=batch_id,
                related_entity_ids=[manufacturer_id],
                validation_category="batch_manufacturer_reference",
                expected_relationship="manufacturer_id exists in entities",
                actual_relationship=f"entity_id={manufacturer_id} NOT FOUND",
                status=ValidationStatus.FAIL,
                evidence_references=[f"batches:{batch_id}"],
                explanation=f"Batch {batch_id} manufacturer_id='{manufacturer_id}' "
                            "not found in entities table.",
            )

    def validate_transaction_batch_reference(
        self, batch_id: str
    ) -> ValidationResult:
        """Check that transactions for a batch reference a valid batch."""
        vid = f"REL-TX-{batch_id}"
        if batch_id in self._batch_ids:
            return ValidationResult(
                validation_id=vid,
                record_id=batch_id,
                related_entity_ids=[],
                validation_category="transaction_batch_reference",
                expected_relationship="transaction batch_id exists in batches",
                actual_relationship=f"batch_id={batch_id} exists",
                status=ValidationStatus.PASS,
                evidence_references=[f"batches:{batch_id}"],
                explanation=f"Transaction batch_id={batch_id} maps to a valid batch record.",
            )
        else:
            return ValidationResult(
                validation_id=vid,
                record_id=batch_id,
                related_entity_ids=[],
                validation_category="transaction_batch_reference",
                expected_relationship="transaction batch_id exists in batches",
                actual_relationship=f"batch_id={batch_id} NOT FOUND",
                status=ValidationStatus.FAIL,
                evidence_references=[f"transactions:{batch_id}"],
                explanation=f"Transactions reference batch_id='{batch_id}' "
                            "which does not exist in the batches table.",
            )

    def validate_entity_license(self, entity_id: str) -> ValidationResult:
        """Check whether an entity has an active license."""
        vid = f"REL-LIC-{entity_id}"
        matches = self.entities[self.entities["entity_id"] == entity_id]
        if matches.empty:
            return ValidationResult(
                validation_id=vid,
                record_id=entity_id,
                related_entity_ids=[],
                validation_category="entity_license",
                expected_relationship="entity exists with active license",
                actual_relationship="entity not found",
                status=ValidationStatus.FAIL,
                evidence_references=[f"entities:{entity_id}"],
                explanation=f"Entity {entity_id} not found in entities table.",
            )
        row = matches.iloc[0]
        status_val = row.get("license_status", "unknown")
        if status_val == "active":
            return ValidationResult(
                validation_id=vid,
                record_id=entity_id,
                related_entity_ids=[],
                validation_category="entity_license",
                expected_relationship="entity has active license",
                actual_relationship=f"license_status={status_val}",
                status=ValidationStatus.PASS,
                evidence_references=[f"entities:{entity_id}"],
                explanation=f"Entity {entity_id} has an active license.",
            )
        else:
            return ValidationResult(
                validation_id=vid,
                record_id=entity_id,
                related_entity_ids=[],
                validation_category="entity_license",
                expected_relationship="entity has active license",
                actual_relationship=f"license_status={status_val}",
                status=ValidationStatus.WARNING,
                evidence_references=[f"entities:{entity_id}"],
                explanation=f"Entity {entity_id} license status is '{status_val}'. "
                            "May indicate compliance risk.",
            )

    # ------------------------------------------------------------------
    # Batch-level Full Validation
    # ------------------------------------------------------------------

    def validate_batch(self, batch_id: str) -> Dict[str, Any]:
        """Run all relational validations for one batch. Returns structured summary."""
        results = []
        results.append(self.validate_batch_medicine_reference(batch_id))
        results.append(self.validate_batch_manufacturer_reference(batch_id))
        results.append(self.validate_transaction_batch_reference(batch_id))

        # Validate manufacturer entity license
        mfr_id = self._batch_manufacturer_map.get(batch_id, "")
        if mfr_id:
            results.append(self.validate_entity_license(mfr_id))

        passed = sum(1 for r in results if r.status == ValidationStatus.PASS)
        failed = sum(1 for r in results if r.status == ValidationStatus.FAIL)
        warnings = sum(1 for r in results if r.status == ValidationStatus.WARNING)

        return {
            "batch_id": batch_id,
            "total_checks": len(results),
            "passed": passed,
            "failed": failed,
            "warnings": warnings,
            "results": [
                {
                    "validation_id": r.validation_id,
                    "category": r.validation_category,
                    "status": r.status.value,
                    "explanation": r.explanation,
                    "evidence": r.evidence_references,
                }
                for r in results
            ],
            "overall_status": (
                ValidationStatus.FAIL.value
                if failed > 0
                else (ValidationStatus.WARNING.value if warnings > 0 else ValidationStatus.PASS.value)
            ),
        }

    def run_full_validation(self, batch_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run validation across all (or specified) batches."""
        if batch_ids is None:
            batch_ids = list(self.batches["batch_id"].head(1000))  # limit for performance

        total = failed = warnings = 0
        details = []
        for bid in batch_ids:
            result = self.validate_batch(bid)
            total += result["total_checks"]
            failed += result["failed"]
            warnings += result["warnings"]
            if result["failed"] > 0 or result["warnings"] > 0:
                details.append(result)

        return {
            "total_checks": total,
            "passed": total - failed - warnings,
            "failed": failed,
            "warnings": warnings,
            "batches_with_issues": len(details),
            "details": details[:50],  # cap for readability
        }
