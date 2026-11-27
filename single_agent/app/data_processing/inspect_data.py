"""
Dataset inspection script for PHANTOM single-agent system.
Run this to generate a full schema summary of all parquet files.
"""
import pandas as pd
import json
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.abspath(os.path.join(PROJECT_ROOT, "..", "Data"))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "outputs")

files = {
    "batches": "batches.parquet",
    "entities": "entities.parquet",
    "fraud_events": "fraud_events.parquet",
    "medicines": "medicines.parquet",
    "transactions": "transactions.parquet",
}

schema_summary = {}

for name, filename in files.items():
    path = os.path.join(DATA_DIR, filename)
    df = pd.read_parquet(path)
    info = {
        "shape": {"rows": int(df.shape[0]), "cols": int(df.shape[1])},
        "columns": {
            col: {
                "dtype": str(df[col].dtype),
                "null_count": int(df[col].isnull().sum()),
                "unique_count": int(df[col].nunique()),
                "sample_values": [str(v) for v in df[col].dropna().head(5).tolist()],
            }
            for col in df.columns
        },
    }
    schema_summary[name] = info
    print(f"\n{'='*60}")
    print(f"TABLE: {name}")
    print(f"Shape: {df.shape[0]:,} rows x {df.shape[1]} cols")
    print(f"Columns:")
    for col in df.columns:
        col_info = info["columns"][col]
        print(f"  {col:<45} {col_info['dtype']:<20} nulls={col_info['null_count']:>8}  uniq={col_info['unique_count']:>8}")
    print(f"\nSample data (2 rows):")
    print(df.head(2).to_string())
    print(f"\nNull summary:")
    nulls = df.isnull().sum()
    if nulls.any():
        print(nulls[nulls > 0].to_string())
    else:
        print("  No nulls")

# Save schema summary
os.makedirs(OUTPUT_DIR, exist_ok=True)
summary_path = os.path.join(OUTPUT_DIR, "data_schema_summary.json")
with open(summary_path, "w") as f:
    json.dump(schema_summary, f, indent=2, default=str)

print(f"\n\nSchema summary saved to {summary_path}")
print("\n\n=== RELATIONSHIP ANALYSIS ===")

# Load all dataframes for relationship analysis
dfs = {}
for name, filename in files.items():
    dfs[name] = pd.read_parquet(os.path.join(DATA_DIR, filename))

# Check common key overlaps
print("\nChecking key overlaps between tables...")

# Try common key columns
key_candidates = ["batch_id", "medicine_id", "entity_id", "transaction_id", 
                  "batch_number", "entity_code", "serial_number", "shipment_id",
                  "supplier_id", "distributor_id", "manufacturer_id"]

for key in key_candidates:
    present_in = []
    for name, df in dfs.items():
        if key in df.columns:
            present_in.append(name)
    if len(present_in) > 1:
        print(f"  Key '{key}' present in: {present_in}")

# Check fraud labels
print("\n=== FRAUD/ANOMALY LABELS CHECK ===")
for name, df in dfs.items():
    for col in df.columns:
        if any(kw in col.lower() for kw in ["fraud", "anomal", "label", "flag", "suspicious", "fake", "counterfeit", "invalid"]):
            vc = df[col].value_counts()
            print(f"  {name}.{col}: {dict(vc)}")
