"""Point-in-time transaction features built from the verified integration output."""

import numpy as np
import pandas as pd

from .integration import (
    EVENT_FEATURES,
    OUTPUT_COLUMNS as INTEGRATED_COLUMNS,
    PREDICTION_TIMESTAMP,
    TRANSACTION_KEY,
    require_unique_key,
)


PRODUCT_FEATURES = ("is_cold_chain", "storage_range_width")
HISTORY_FEATURES = (
    "prior_event_count",
    "seconds_since_prior_event",
    "seconds_since_first_prior_event",
    "prior_mean_humidity",
    "prior_mean_weight",
    "prior_rfid_scan_rate",
    "prior_door_open_rate",
)
FEATURE_COLUMNS = (*EVENT_FEATURES, *PRODUCT_FEATURES, *HISTORY_FEATURES)
OUTPUT_COLUMNS = ("batch_id", PREDICTION_TIMESTAMP, *FEATURE_COLUMNS)


def _batch_history(ordered):
    """Return one history snapshot for each batch and distinct prediction time."""
    clock = PREDICTION_TIMESTAMP
    snapshots = ordered.groupby(["batch_id", clock], sort=False).agg(
        events=("event_type", "size"),
        humidity_total=("humidity", "sum"),
        weight_total=("weight", "sum"),
        scans=("rfid_scanned", "sum"),
        door_opens=("door_open", "sum"),
    ).reset_index()

    totals = ["events", "humidity_total", "weight_total", "scans", "door_opens"]
    by_batch = snapshots.groupby("batch_id", sort=False)
    cumulative = by_batch[totals].cumsum()
    # Shift whole timestamp groups. Current and simultaneous rows never enter their own history.
    past = cumulative.groupby(snapshots["batch_id"], sort=False).shift(fill_value=0)
    count = past["events"]
    denominator = count.where(count.gt(0))
    first_time = by_batch[clock].transform("first").where(count.gt(0))
    previous_time = by_batch[clock].shift()

    return snapshots[["batch_id", clock]].assign(
        prior_event_count=count,
        seconds_since_prior_event=(snapshots[clock] - previous_time).dt.total_seconds(),
        seconds_since_first_prior_event=(snapshots[clock] - first_time).dt.total_seconds(),
        prior_mean_humidity=past["humidity_total"] / denominator,
        prior_mean_weight=past["weight_total"] / denominator,
        prior_rfid_scan_rate=past["scans"] / denominator,
        prior_door_open_rate=past["door_opens"] / denominator,
    )


def build_features(integrated):
    """Return one chronological feature row per event, using only allowed inputs.

    Pass only events eligible for the observed history stream. The caller owns
    split eligibility and whether an event's readings had arrived at scoring.
    Extra input columns cannot enter the feature calculation.
    """
    records = integrated.loc[:, list(INTEGRATED_COLUMNS)]
    require_unique_key(records, TRANSACTION_KEY, "feature input")
    if records.isna().any().any():
        raise ValueError("The verified fields must be complete before feature engineering.")
    clock = records[PREDICTION_TIMESTAMP]
    if not pd.api.types.is_datetime64_any_dtype(clock) or clock.dt.tz is not None:
        raise ValueError("Use the verified timezone-naive transaction timestamp.")
    if not np.isfinite(records[["humidity", "weight"]].to_numpy(dtype=float)).all():
        raise ValueError("Historical readings must be finite.")

    ordered = records.sort_values([PREDICTION_TIMESTAMP, *TRANSACTION_KEY], ignore_index=True)
    ordered["storage_range_width"] = ordered["storage_max"] - ordered["storage_min"]
    if ordered["storage_range_width"].lt(0).any():
        raise ValueError("Medicine storage limits are reversed.")

    history = _batch_history(ordered)
    output = ordered.merge(
        history, on=["batch_id", PREDICTION_TIMESTAMP], how="left", sort=False, validate="many_to_one",
    )
    result = output.loc[:, list(OUTPUT_COLUMNS)]
    if len(result) != len(ordered) or result["prior_event_count"].isna().any():
        raise ValueError("Each transaction must match exactly one history snapshot.")
    return result

