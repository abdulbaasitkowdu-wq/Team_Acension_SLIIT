"""Build the TRACE-X transaction feature table with validated lookup joins."""

import numpy as np
import pandas as pd


TRANSACTION_KEY = ("batch_id", "leg", "event_type")
PREDICTION_TIMESTAMP = "timestamp"
EVENT_FEATURES = (
    "event_type", "leg", "humidity", "rfid_scanned", "weight", "door_open", "battery_level",
)
MEDICINE_FEATURES = ("storage_min", "storage_max", "is_cold_chain")
FEATURE_COLUMNS = (*EVENT_FEATURES, *MEDICINE_FEATURES)
OUTPUT_COLUMNS = ("batch_id", PREDICTION_TIMESTAMP, *FEATURE_COLUMNS)

# These existing fields help verify upstream catalogue use, but are never output.
CATALOGUE_AUDIT_COLUMNS = ("batch_tx_index", "temperature", "rolling_excursion_rate")
TRANSACTION_READ_COLUMNS = (*OUTPUT_COLUMNS[:2], *EVENT_FEATURES, *CATALOGUE_AUDIT_COLUMNS)
BATCH_READ_COLUMNS = ("batch_id", "medicine_id", "manufacturer_id", "production_date")
MEDICINE_READ_COLUMNS = ("medicine_id", "drug_type", *MEDICINE_FEATURES)
ENTITY_READ_COLUMNS = ("entity_id", "entity_type")


class IntegrationError(ValueError):
    """The input data do not meet the expected join or timing rules."""


def require_unique_key(frame, columns, table):
    """Reject missing or repeated values in a parent or transaction key."""
    columns = list(columns)
    missing = int(frame[columns].isna().any(axis=1).sum())
    repeated = int(frame.duplicated(columns).sum())
    if missing or repeated:
        raise IntegrationError(f"{table}: {missing:,} null keys and {repeated:,} duplicate keys.")


def checked_lookup(left, right, *, left_key, right_key=None, relationship):
    """Look up one parent per row and produce an audit record."""
    right_key = right_key or left_key
    require_unique_key(right, [right_key], f"{relationship} parent")
    null_keys = int(left[left_key].isna().sum())
    if null_keys:
        raise IntegrationError(f"{relationship}: {null_keys:,} null foreign keys.")

    # Use a marker to distinguish a missing parent from a null value in a matched parent.
    marker = "_lookup_match"
    shared = set(left.columns) & set(right.columns)
    if left_key == right_key:
        shared.discard(left_key)
    if shared or marker in left.columns or marker in right.columns:
        raise IntegrationError(f"{relationship}: ambiguous lookup columns {sorted(shared)}.")
    joined = left.merge(
        right, left_on=left_key, right_on=right_key, how="left",
        sort=False, validate="many_to_one", indicator=marker,
    )
    unmatched = int(joined[marker].ne("both").sum())
    if unmatched or len(joined) != len(left):
        raise IntegrationError(f"{relationship}: {unmatched:,} unmatched rows. "
                               f"Expected {len(left):,} rows, got {len(joined):,}.")
    audit = {
        "join": relationship,
        "relationship": "many-to-one",
        "parent_rows": len(right),
        "rows_before": len(left),
        "rows_after": len(joined),
        "unmatched_foreign_keys": unmatched,
    }
    return joined.drop(columns=marker), audit


def verify_event_timing(transactions):
    """Reject missing event clocks or events that predate batch production."""
    timestamp = transactions[PREDICTION_TIMESTAMP]
    production = pd.to_datetime(transactions["production_date"], errors="raise")
    if not pd.api.types.is_datetime64_any_dtype(timestamp) or timestamp.dt.tz is not None:
        raise IntegrationError("Expected the cleaned timezone-naive transaction timestamp.")
    if timestamp.isna().any() or production.isna().any():
        raise IntegrationError("Missing transaction timestamp or batch production date.")
    preproduction = int(timestamp.dt.normalize().lt(production).sum())
    if preproduction:
        raise IntegrationError(f"{preproduction:,} transactions before batch production.")
    return preproduction


def verify_static_storage_catalogue(medicines, storage_ranges):
    """Validate storage fields against the unchanged specification for each drug type."""
    for column, config_key in zip(MEDICINE_FEATURES, ("min", "max", "cold_chain"), strict=True):
        expected = medicines["drug_type"].map({kind: spec[config_key] for kind, spec in storage_ranges.items()})
        matches = medicines[column].eq(expected).fillna(False)
        if expected.isna().any() or not matches.all():
            raise IntegrationError(f"Medicine catalogue {column} does not match the fixed configuration.")


def verify_storage_used_at_events(transactions):
    """Reconstruct the existing rate using only each event and its preceding batch events."""
    columns = ("batch_id", PREDICTION_TIMESTAMP, *CATALOGUE_AUDIT_COLUMNS, "storage_min", "storage_max")
    ordered = transactions.loc[:, list(columns)].sort_values(["batch_id", "batch_tx_index"])
    if ordered.isna().any().any():
        raise IntegrationError("Storage timing audit requires complete batch order and readings.")
    grouped = ordered.groupby("batch_id", sort=False)
    if not ordered["batch_tx_index"].eq(grouped.cumcount() + 1).all():
        raise IntegrationError("Batch event indices are incomplete or repeated.")
    previous = grouped[PREDICTION_TIMESTAMP].shift()
    if ordered[PREDICTION_TIMESTAMP].le(previous).any():
        raise IntegrationError("Batch event order is ambiguous. Cannot verify the storage lookup causally.")

    excursion = ordered["temperature"].lt(ordered["storage_min"]) | ordered["temperature"].gt(ordered["storage_max"])
    expected = excursion.groupby(ordered["batch_id"], sort=False).cumsum() / ordered["batch_tx_index"]
    matches = np.isclose(expected, ordered["rolling_excursion_rate"], rtol=0, atol=1e-12)
    mismatched = int(np.count_nonzero(~matches))
    if mismatched:
        raise IntegrationError(f"{mismatched:,} recorded storage rates disagree with current-or-earlier readings.")
    return int(np.count_nonzero(matches))


def integrate_transactions(transactions, batches, medicines, entities, storage_ranges):
    """Return an allowlisted feature table, join counts, and timing checks."""
    events = transactions.loc[:, list(TRANSACTION_READ_COLUMNS)]
    require_unique_key(events, TRANSACTION_KEY, "transactions before joins")
    batch_lookup = batches.loc[:, list(BATCH_READ_COLUMNS)]
    require_unique_key(batch_lookup, ["batch_id"], "batches")
    catalogue = medicines.loc[:, list(MEDICINE_READ_COLUMNS)]
    verify_static_storage_catalogue(catalogue, storage_ranges)

    batch_lookup, entity_audit = checked_lookup(
        batch_lookup, entities.loc[:, list(ENTITY_READ_COLUMNS)],
        left_key="manufacturer_id", right_key="entity_id",
        relationship="batches.manufacturer_id to entities.entity_id",
    )
    if not batch_lookup["entity_type"].eq("manufacturer").fillna(False).all():
        raise IntegrationError("A batch references an entity that is not a manufacturer.")
    batch_lookup = batch_lookup.drop(columns=["entity_id", "entity_type", "manufacturer_id"])
    batch_lookup, medicine_audit = checked_lookup(
        batch_lookup, catalogue.loc[:, ["medicine_id", *MEDICINE_FEATURES]],
        left_key="medicine_id",
        relationship="batches.medicine_id to medicines.medicine_id",
    )
    integrated, batch_audit = checked_lookup(
        events, batch_lookup, left_key="batch_id",
        relationship="transactions.batch_id to batches.batch_id",
    )
    preproduction = verify_event_timing(integrated)
    storage_matches = verify_storage_used_at_events(integrated)

    output = integrated.loc[:, list(OUTPUT_COLUMNS)]
    require_unique_key(output, TRANSACTION_KEY, "transactions after joins")
    if not output.loc[:, list(TRANSACTION_KEY)].equals(events.loc[:, list(TRANSACTION_KEY)].reset_index(drop=True)):
        raise IntegrationError("Integration changed transaction identity or row order.")
    timings = {
        "preproduction_transactions": preproduction,
        "storage_rate_matches": storage_matches,
        "catalogue_records_checked": len(catalogue),
    }
    return output, [entity_audit, medicine_audit, batch_audit], timings

