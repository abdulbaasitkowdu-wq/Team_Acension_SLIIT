import hashlib
import json
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from src.features import FEATURE_COLUMNS, OUTPUT_COLUMNS
from src.integration import PREDICTION_TIMESTAMP, TRANSACTION_KEY
from src.preprocessing import SPLIT_NAMES, TARGET_COLUMN


ROOT = Path(__file__).resolve().parents[1]
FINAL = ROOT / "processed" / "final"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def test_frozen_splits_have_no_key_batch_or_timestamp_overlap():
    processed = ROOT / "processed"
    boundary = read_json(processed / "split_boundaries.json")
    artifact = processed / boundary["assignment_file"]
    assert digest(artifact) == boundary["assignment_sha256"]
    frozen = pd.read_parquet(artifact)
    assert len(frozen) == boundary["source_rows"]
    assert not frozen.duplicated(list(TRANSACTION_KEY)).any()
    assert frozen.groupby("batch_id")["split"].nunique().eq(1).all()
    retained = frozen.loc[frozen["split"].isin(SPLIT_NAMES)]
    assert retained.groupby(PREDICTION_TIMESTAMP)["split"].nunique().eq(1).all()
    clock = retained.groupby("split")[PREDICTION_TIMESTAMP].agg(["min", "max"])
    assert clock.loc["train", "max"] < clock.loc["validation", "min"]
    assert clock.loc["validation", "max"] < clock.loc["test", "min"]


def test_materialized_features_and_labels_match_frozen_contract():
    manifest = read_json(FINAL / "manifest.json")
    processed = ROOT / "processed"
    boundary = read_json(processed / "split_boundaries.json")
    assert manifest["split_assignment_sha256"] == boundary["assignment_sha256"]
    assert manifest["input_features"] == list(FEATURE_COLUMNS)
    names = read_json(ROOT / "artifacts" / "final_feature_names.json")
    assert manifest["output_features"] == names
    assert all(not any(flag in name for flag in (
        "fraud", "timestamp", "batch_id", "split", "temperature", "rolling_excursion",
        "seal_intact", "qr_verified", "gps_", "duplicate_serial", "cumulative_excursion_time",
    )) for name in names)
    assert digest(ROOT / "artifacts" / "preprocessor.joblib") == manifest["preprocessor_sha256"]

    order = [PREDICTION_TIMESTAMP, *TRANSACTION_KEY]
    key = list(TRANSACTION_KEY)
    for split in SPLIT_NAMES:
        expected_rows = boundary["split_summary"][split]["rows"]
        entry = manifest["splits"][split]
        assert entry["rows"] == expected_rows
        expected = pd.read_parquet(
            processed / boundary["assignment_file"], columns=order, filters=[("split", "=", split)],
        ).sort_values(order, ignore_index=True)
        for file in entry["files"].values():
            path = FINAL / file["name"]
            assert digest(path) == file["sha256"]
            assert pq.read_metadata(path).num_rows == expected_rows

        engineered_path = FINAL / entry["files"]["engineered"]["name"]
        assert pq.read_schema(engineered_path).names == list(OUTPUT_COLUMNS)
        pd.testing.assert_frame_equal(pd.read_parquet(engineered_path, columns=order), expected, check_dtype=False)
        target_path = FINAL / entry["files"]["target"]["name"]
        assert pq.read_schema(target_path).names == [*key, TARGET_COLUMN]
        targets = pd.read_parquet(target_path)
        pd.testing.assert_frame_equal(targets[key], expected[key], check_dtype=False)
        assert pq.read_schema(target_path).field(TARGET_COLUMN).type == pa.uint8()
        assert targets[TARGET_COLUMN].notna().all() and targets[TARGET_COLUMN].isin([0, 1]).all()

        matrix = FINAL / entry["files"]["matrix"]["name"]
        schema = pq.read_schema(matrix)
        assert schema.names == names and all(field.type == pa.float32() for field in schema)

