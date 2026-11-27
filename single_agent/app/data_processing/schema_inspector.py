"""
PHANTOM — Schema Inspector
Provides schema summary generation and validation for all loaded datasets.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd

from app.config.dataset_mapping import ALL_MAPPINGS


class SchemaInspector:
    """
    Inspects loaded DataFrames and returns structured schema summaries.
    Used to validate that required columns are present before processing.
    """

    def inspect_dataframe(
        self, table_name: str, df: pd.DataFrame
    ) -> Dict[str, Any]:
        """Return a structured schema dict for one DataFrame."""
        mapping = ALL_MAPPINGS.get(table_name)
        expected_cols = set(mapping.columns.keys()) if mapping else set()
        actual_cols = set(df.columns)

        present = expected_cols & actual_cols
        missing = expected_cols - actual_cols
        extra = actual_cols - expected_cols

        return {
            "table": table_name,
            "rows": len(df),
            "cols": len(df.columns),
            "columns": {
                col: {
                    "dtype": str(df[col].dtype),
                    "null_count": int(df[col].isnull().sum()),
                    "null_pct": round(df[col].isnull().mean() * 100, 2),
                    "unique_count": int(df[col].nunique()),
                }
                for col in df.columns
            },
            "expected_cols_present": sorted(list(present)),
            "expected_cols_missing": sorted(list(missing)),
            "extra_cols": sorted(list(extra)),
            "schema_valid": len(missing) == 0,
            "unavailable_fields": mapping.unavailable_fields if mapping else [],
        }

    def inspect_all(
        self,
        batches: pd.DataFrame,
        entities: pd.DataFrame,
        fraud_events: pd.DataFrame,
        medicines: pd.DataFrame,
        transactions: pd.DataFrame,
    ) -> Dict[str, Any]:
        """Inspect all five tables and return a combined summary."""
        tables = {
            "batches": batches,
            "entities": entities,
            "fraud_events": fraud_events,
            "medicines": medicines,
            "transactions": transactions,
        }
        summary = {}
        all_valid = True
        for name, df in tables.items():
            result = self.inspect_dataframe(name, df)
            summary[name] = result
            if not result["schema_valid"]:
                all_valid = False
        summary["_meta"] = {
            "all_schemas_valid": all_valid,
            "total_rows": sum(v["rows"] for k, v in summary.items() if k != "_meta"),
        }
        return summary

    def get_missing_fields_report(self, schema_summary: Dict[str, Any]) -> List[str]:
        """Return a list of missing-field warnings."""
        warnings = []
        for table, info in schema_summary.items():
            if table.startswith("_"):
                continue
            for col in info.get("expected_cols_missing", []):
                warnings.append(
                    f"Table '{table}': expected column '{col}' is MISSING from dataset."
                )
        return warnings
