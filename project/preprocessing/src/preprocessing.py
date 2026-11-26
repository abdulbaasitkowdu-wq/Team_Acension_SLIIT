"""Training-only preprocessing for the audited TRACE-X features."""

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight

from .features import FEATURE_COLUMNS
from .integration import TRANSACTION_KEY, require_unique_key


CATEGORICAL_FEATURES = ("event_type", "rfid_scanned", "door_open", "is_cold_chain")
NUMERICAL_FEATURES = tuple(name for name in FEATURE_COLUMNS if name not in CATEGORICAL_FEATURES)
SPLIT_NAMES = ("train", "validation", "test")
TARGET_COLUMN = "is_fraud_ground_truth"
TARGET_CLASSES = np.array([0, 1], dtype=np.uint8)


def numeric_as_float32(frame):
    """Use a compact floating-point type that can represent missing history."""
    return frame.to_numpy(dtype=np.float32, na_value=np.nan)


def categorical_as_text(frame):
    """Use consistent strings, including for binary flags, while keeping missing values."""
    return frame.astype("string").astype(object).where(frame.notna(), np.nan)


def make_preprocessor():
    """Return an unfitted transformer for exactly the audited input types."""
    numerical = Pipeline([
        ("float32", FunctionTransformer(numeric_as_float32, feature_names_out="one-to-one")),
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    categorical = Pipeline([
        ("text", FunctionTransformer(categorical_as_text, feature_names_out="one-to-one")),
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("encode", OneHotEncoder(handle_unknown="ignore", sparse_output=True, dtype=np.float32)),
    ])
    return ColumnTransformer(
        [
            ("numeric", numerical, list(NUMERICAL_FEATURES)),
            ("categorical", categorical, list(CATEGORICAL_FEATURES)),
        ],
        remainder="drop",
        # A float32 CSR value also needs an int32 column index. Keep the final
        # block sparse when density is below half. The encoder itself stays sparse.
        sparse_threshold=0.5,
    )


def index_targets(target_table):
    """Make the separate binary label table addressable by transaction key."""
    key = list(TRANSACTION_KEY)
    require_unique_key(target_table, key, "target table")
    labels = target_table[TARGET_COLUMN]
    if labels.isna().any() or not labels.isin(TARGET_CLASSES).all():
        raise ValueError("Expected a complete binary target containing only 0 and 1.")
    return target_table.set_index(key)[TARGET_COLUMN].astype(np.uint8)


def align_target(row_keys, indexed_target):
    """Return labels in exactly the feature rows' order, without adding them to X."""
    key = list(TRANSACTION_KEY)
    require_unique_key(row_keys, key, "feature rows")
    row_index = pd.MultiIndex.from_frame(row_keys.loc[:, key])
    matched = indexed_target.reindex(row_index)
    if matched.isna().any():
        raise ValueError(f"{int(matched.isna().sum()):,} feature rows lack a matching target.")
    return matched.to_numpy(dtype=np.uint8)


def training_class_weights(y_train):
    """Balance the two labelled classes using the training targets alone."""
    values = np.asarray(y_train)
    if values.ndim != 1 or set(np.unique(values)) != {0, 1}:
        raise ValueError("Expected both binary classes in the one-dimensional training target.")
    weights = compute_class_weight("balanced", classes=TARGET_CLASSES, y=values)
    return {int(label): float(weight) for label, weight in zip(TARGET_CLASSES, weights, strict=True)}

