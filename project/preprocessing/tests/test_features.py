import pandas as pd

from src.features import HISTORY_FEATURES, OUTPUT_COLUMNS, build_features


def example_events():
    """A batch with a tie, future events and a second independent batch."""
    rows = [
        ("A", "2025-01-01 08:00", "manufacturing", 0, 30.0, 8.0, True, False),
        ("A", "2025-01-01 09:00", "shipment", 0, 50.0, 10.0, False, True),
        ("A", "2025-01-01 09:00", "sale", 0, 70.0, 12.0, True, True),
        ("B", "2025-01-01 09:30", "manufacturing", 0, 36.0, 9.0, True, False),
        ("A", "2025-01-01 10:00", "warehouse_in", 0, 45.0, 11.0, False, False),
        ("A", "2025-01-01 11:00", "sale", 1, 42.0, 10.0, True, False),
    ]
    events = pd.DataFrame(rows, columns=[
        "batch_id", "timestamp", "event_type", "leg", "humidity", "weight", "rfid_scanned", "door_open",
    ])
    events["timestamp"] = pd.to_datetime(events["timestamp"])
    return events.assign(battery_level=70, is_cold_chain=True, storage_min=2, storage_max=8)


def at_hour(frame, hour):
    return frame[(frame["batch_id"] == "A") & (frame["timestamp"].dt.hour == hour)]


def test_strict_history_and_batch_isolation():
    result = build_features(example_events().iloc[::-1])
    assert result["timestamp"].is_monotonic_increasing
    first = result[result["prior_event_count"].eq(0)]
    assert first["batch_id"].tolist() == ["A", "B"]
    assert first[list(HISTORY_FEATURES[1:])].isna().all().all()
    tied = at_hour(result, 9)
    assert tied["prior_event_count"].tolist() == [1, 1]
    assert tied["prior_mean_weight"].tolist() == [8.0, 8.0]
    assert tied["prior_rfid_scan_rate"].tolist() == [1.0, 1.0]

    later = at_hour(result, 10).iloc[0]
    assert later["prior_event_count"] == 3
    assert later["seconds_since_prior_event"] == 3600
    assert later["seconds_since_first_prior_event"] == 7200
    assert later["prior_mean_humidity"] == 50
    assert later["prior_mean_weight"] == 10
    assert later["prior_rfid_scan_rate"] == 2 / 3
    assert later["prior_door_open_rate"] == 2 / 3


def test_changing_or_adding_future_rows_cannot_change_earlier_features():
    events = example_events()
    cutoff = pd.Timestamp("2025-01-01 10:00")
    baseline = build_features(events)
    changed = events.copy()
    future = changed["timestamp"].gt(cutoff)
    changed.loc[future, ["humidity", "weight"]] = [95.0, 35.0]
    changed.loc[future, ["rfid_scanned", "door_open"]] = [False, True]
    changed.loc[future, "timestamp"] += pd.Timedelta(hours=2)
    new_event = changed.loc[future].assign(leg=2, timestamp=pd.Timestamp("2025-01-01 14:00"))
    changed = pd.concat([changed, new_event], ignore_index=True)

    before = baseline.loc[baseline["timestamp"].le(cutoff)]
    after = build_features(changed.iloc[::-1]).loc[lambda frame: frame["timestamp"].le(cutoff)]
    prefix_only = build_features(events.loc[events["timestamp"].le(cutoff)])
    pd.testing.assert_frame_equal(before, after, check_exact=True)
    pd.testing.assert_frame_equal(before, prefix_only, check_exact=True)


def test_current_values_and_timestamp_ties_do_not_enter_history():
    events = example_events()
    baseline = build_features(events)
    tied = events["timestamp"].dt.hour.eq(9)
    events.loc[tied, ["humidity", "weight"]] = [60.0, 42.0]
    events.loc[tied, ["rfid_scanned", "door_open"]] = [False, False]
    modified = build_features(events)
    pd.testing.assert_frame_equal(
        at_hour(baseline, 9)[list(HISTORY_FEATURES)],
        at_hour(modified, 9)[list(HISTORY_FEATURES)],
        check_exact=True,
    )
    assert at_hour(modified, 10)["prior_mean_weight"].iloc[0] != at_hour(baseline, 10)["prior_mean_weight"].iloc[0]


def test_unapproved_columns_cannot_enter_features():
    events = example_events()
    expected = build_features(events)
    actual = build_features(events.assign(is_fraud_ground_truth=True, temperature=987))
    pd.testing.assert_frame_equal(expected, actual)
    assert actual.columns.tolist() == list(OUTPUT_COLUMNS)
    assert actual["storage_range_width"].eq(6).all()

