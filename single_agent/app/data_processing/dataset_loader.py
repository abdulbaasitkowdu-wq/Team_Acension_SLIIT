"""
PHANTOM — Dataset Loader (Component A)
Loads all preprocessed parquet files, validates schemas, establishes relationships.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import pandas as pd

from app.config.dataset_mapping import (
    ALL_MAPPINGS,
    BATCHES_MAPPING,
    ENTITIES_MAPPING,
    FRAUD_EVENTS_MAPPING,
    MEDICINES_MAPPING,
    TRANSACTIONS_MAPPING,
)
from app.config.settings import settings

logger = logging.getLogger(__name__)


class DatasetStore:
    """
    In-memory store for all loaded datasets.
    Provides efficient record retrieval without loading entire tables into LLM context.
    """

    def __init__(self) -> None:
        self.batches: Optional[pd.DataFrame] = None
        self.entities: Optional[pd.DataFrame] = None
        self.fraud_events: Optional[pd.DataFrame] = None
        self.medicines: Optional[pd.DataFrame] = None
        self.transactions: Optional[pd.DataFrame] = None
        self._metadata: Dict[str, Any] = {}
        self._loaded = False

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load(self, data_dir: Optional[str] = None) -> "DatasetStore":
        """Load all parquet files from data_dir."""
        data_path = Path(data_dir or settings.data_dir)
        logger.info(f"Loading datasets from: {data_path}")

        self.batches = self._load_parquet(data_path, "batches.parquet")
        self.entities = self._load_parquet(data_path, "entities.parquet")
        self.fraud_events = self._load_parquet(data_path, "fraud_events.parquet")
        self.medicines = self._load_parquet(data_path, "medicines.parquet")
        self.transactions = self._load_parquet(data_path, "transactions.parquet")

        self._post_process()
        self._build_metadata()
        self._loaded = True
        logger.info("All datasets loaded successfully.")
        return self

    def _load_parquet(self, data_path: Path, filename: str) -> pd.DataFrame:
        path = data_path / filename
        if not path.exists():
            raise FileNotFoundError(f"Dataset file not found: {path}")
        df = pd.read_parquet(path)
        logger.info(f"Loaded {filename}: {df.shape[0]:,} rows × {df.shape[1]} cols")
        return df

    def _post_process(self) -> None:
        """Normalize timestamps and add index columns."""
        # Normalize production_date and expiry_date to datetime
        for col in ("production_date", "expiry_date"):
            if col in self.batches.columns:
                self.batches[col] = pd.to_datetime(self.batches[col], utc=True, errors="coerce")

        # Normalize license_expiry
        if "license_expiry" in self.entities.columns:
            self.entities["license_expiry"] = pd.to_datetime(
                self.entities["license_expiry"], utc=True, errors="coerce"
            )

        # Transactions timestamp — already datetime64[us], localize to UTC
        if "timestamp" in self.transactions.columns:
            ts = self.transactions["timestamp"]
            if ts.dt.tz is None:
                self.transactions["timestamp"] = ts.dt.tz_localize("UTC")
            else:
                self.transactions["timestamp"] = ts.dt.tz_convert("UTC")

        # Create a composite transaction_id: batch_id|event_type|batch_tx_index
        if all(c in self.transactions.columns for c in ("batch_id", "event_type", "batch_tx_index")):
            self.transactions["transaction_id"] = (
                self.transactions["batch_id"].astype(str)
                + "|"
                + self.transactions["event_type"].astype(str)
                + "|"
                + self.transactions["batch_tx_index"].astype(str)
            )

        # Index transactions by batch_id for fast lookup
        self.transactions.set_index("batch_id", drop=False, inplace=True, append=False)
        self.transactions.index.name = None

        logger.debug("Post-processing complete.")

    def _build_metadata(self) -> None:
        self._metadata = {
            "batches": {
                "rows": len(self.batches),
                "cols": list(self.batches.columns),
                "primary_key": BATCHES_MAPPING.primary_key,
            },
            "entities": {
                "rows": len(self.entities),
                "cols": list(self.entities.columns),
                "primary_key": ENTITIES_MAPPING.primary_key,
            },
            "fraud_events": {
                "rows": len(self.fraud_events),
                "cols": list(self.fraud_events.columns),
                "primary_key": FRAUD_EVENTS_MAPPING.primary_key,
                "fraud_rate": float(self.fraud_events["is_fraud_ground_truth"].mean()),
            },
            "medicines": {
                "rows": len(self.medicines),
                "cols": list(self.medicines.columns),
                "primary_key": MEDICINES_MAPPING.primary_key,
            },
            "transactions": {
                "rows": len(self.transactions),
                "cols": list(self.transactions.columns),
                "primary_key": "batch_id+event_type+batch_tx_index (composite)",
                "event_types": list(self.transactions["event_type"].unique()),
                "fraud_rate": float(self.transactions["is_fraud_ground_truth"].mean()),
            },
        }

    @property
    def metadata(self) -> Dict[str, Any]:
        return self._metadata

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ------------------------------------------------------------------
    # Record Retrieval (deterministic — no LLM)
    # ------------------------------------------------------------------

    def get_batch(self, batch_id: str) -> Optional[pd.Series]:
        """Return the batch row for a given batch_id."""
        matches = self.batches[self.batches["batch_id"] == batch_id]
        return matches.iloc[0] if not matches.empty else None

    def get_medicine(self, medicine_id: str) -> Optional[pd.Series]:
        matches = self.medicines[self.medicines["medicine_id"] == medicine_id]
        return matches.iloc[0] if not matches.empty else None

    def get_entity(self, entity_id: str) -> Optional[pd.Series]:
        matches = self.entities[self.entities["entity_id"] == entity_id]
        return matches.iloc[0] if not matches.empty else None

    def get_fraud_event(self, batch_id: str) -> Optional[pd.Series]:
        matches = self.fraud_events[self.fraud_events["batch_id"] == batch_id]
        return matches.iloc[0] if not matches.empty else None

    def get_batch_transactions(self, batch_id: str) -> pd.DataFrame:
        """Return all transaction rows for a given batch_id."""
        try:
            df = self.transactions.loc[[batch_id]]
            return df.sort_values("timestamp")
        except KeyError:
            return pd.DataFrame()

    def get_transactions_by_event_type(
        self, batch_id: str, event_type: str
    ) -> pd.DataFrame:
        df = self.get_batch_transactions(batch_id)
        return df[df["event_type"] == event_type]

    def get_manufacturer_batches(self, manufacturer_id: str) -> pd.DataFrame:
        return self.batches[self.batches["manufacturer_id"] == manufacturer_id]

    def get_fraud_batches_sample(self, limit: int = 100) -> pd.DataFrame:
        """Return a sample of batches flagged as fraudulent in fraud_events."""
        fraud_batch_ids = self.fraud_events[
            self.fraud_events["is_fraud_ground_truth"] == True
        ]["batch_id"]
        return self.batches[self.batches["batch_id"].isin(fraud_batch_ids)].head(limit)

    def get_evaluation_set(
        self, max_fraud: int = 50, max_legit: int = 50
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Return balanced evaluation batches (fraud + legitimate).
        Uses fraud_events ground truth — no data leakage into agent.
        """
        fraud = self.fraud_events[self.fraud_events["is_fraud_ground_truth"] == True].head(max_fraud)
        legit = self.fraud_events[self.fraud_events["is_fraud_ground_truth"] == False].head(max_legit)
        return fraud, legit


# Singleton data store
data_store = DatasetStore()
