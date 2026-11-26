import joblib
import numpy as np
import pandas as pd
import pytest
from scipy import sparse

from src.features import FEATURE_COLUMNS
from src.integration import TRANSACTION_KEY
from src.preprocessing import (
    NUMERICAL_FEATURES,
    TARGET_COLUMN,
    align_target,
    index_targets,
    make_preprocessor,
    training_class_weights,
)


def training_rows():
    rows = pd.DataFrame({field: [1.0, 3.0, np.nan] for field in NUMERICAL_FEATURES})
    rows["event_type"] = ["shipment", "receipt", "shipment"]
    rows["rfid_scanned"] = [True, False, True]
    rows["door_open"] = [False, True, False]
    rows["is_cold_chain"] = [False, True, False]
    return rows.loc[:, list(FEATURE_COLUMNS)]


def as_array(matrix):
    return matrix.toarray() if sparse.issparse(matrix) else matrix


def test_training_statistics_and_unseen_categories_are_preserved_on_transform():
    training = training_rows()
    fitted = make_preprocessor().fit(training)
    numerical = fitted.named_transformers_["numeric"]
    categorical = fitted.named_transformers_["categorical"]
    np.testing.assert_array_equal(numerical["impute"].statistics_, np.full(len(NUMERICAL_FEATURES), 2))
    np.testing.assert_array_equal(numerical["scale"].mean_, np.full(len(NUMERICAL_FEATURES), 2))
    assert categorical["impute"].statistics_[0] == "shipment"
    assert categorical["encode"].categories_[0].tolist() == ["receipt", "shipment"]

    fingerprint = joblib.hash(fitted)
    holdout = training.iloc[:1].assign(event_type="unseen_holdout_category", humidity=10_000)
    transformed = as_array(fitted.transform(holdout))
    missing = as_array(fitted.transform(holdout.assign(event_type=pd.NA)))
    names = fitted.get_feature_names_out()
    event_indices = [i for i, name in enumerate(names) if name.startswith("categorical__event_type_")]
    assert transformed.dtype == np.float32 and np.isfinite(transformed).all()
    assert np.count_nonzero(transformed[:, event_indices]) == 0
    assert np.count_nonzero(missing[:, event_indices]) == 1
    assert joblib.hash(fitted) == fingerprint


def test_training_refit_and_saved_preprocessor_are_reproducible(tmp_path):
    training = training_rows()
    first = make_preprocessor().fit(training)
    second = make_preprocessor().fit(training)
    assert joblib.hash(first) == joblib.hash(second)
    path = tmp_path / "preprocessor.joblib"
    joblib.dump(first, path)
    restored = joblib.load(path)
    assert restored.get_feature_names_out().tolist() == first.get_feature_names_out().tolist()
    np.testing.assert_array_equal(as_array(restored.transform(training)), as_array(first.transform(training)))


def test_target_order_is_keyed_and_missing_or_duplicate_keys_are_rejected():
    keys = pd.DataFrame([("B1", 0, "shipment"), ("B2", 0, "shipment")], columns=TRANSACTION_KEY)
    targets = keys.assign(**{TARGET_COLUMN: [1, 0]})
    indexed = index_targets(targets)
    np.testing.assert_array_equal(align_target(keys.iloc[::-1], indexed), [0, 1])
    with pytest.raises(ValueError, match="lack a matching target"):
        align_target(keys.assign(batch_id=["unknown", "B2"]), indexed)
    with pytest.raises(ValueError, match="duplicate keys"):
        index_targets(pd.concat([targets, targets.iloc[:1]]))


def test_class_weights_follow_training_only_counts():
    np.testing.assert_allclose(list(training_class_weights([0, 0, 0, 1]).values()), [2 / 3, 2])
    with pytest.raises(ValueError, match="both binary classes"):
        training_class_weights([0, 0])

