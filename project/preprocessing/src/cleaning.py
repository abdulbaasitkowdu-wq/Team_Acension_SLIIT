"""Fixed, documented cleaning rules for the released TRACE-X tables."""

from collections import Counter

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq


COLUMN_TYPES = {
    "entities": {
        "text": "entity_id entity_type country regulator enforcement_level city license_number license_status sfda_gmp_status",
        "float": "latitude longitude audit_score",
        "int": "years_of_operation",
        "date": "license_expiry",
        "bool": "gmp_compliant pics_compliant is_importer import_certificate export_certificate customs_clearance batch_release_certificate",
    },
    "medicines": {
        "text": "medicine_id drug_type",
        "int": "storage_min storage_max shelf_life_days",
        "bool": "is_cold_chain",
        "float": "price",
    },
    "batches": {
        "text": "batch_id medicine_id manufacturer_id country_of_origin serial_number lot_number",
        "date": "production_date expiry_date",
        "int": "quantity",
    },
    "fraud_events": {
        "text": "batch_id fraud_type",
        "bool": "is_fraud_ground_truth in_ring",
    },
    "transactions": {
        "text": "batch_id country event_type sensor_id fraud_type previous_hash current_hash",
        "int": "leg battery_level",
        "timestamp": "timestamp",
        "float": "temperature humidity gps_lat gps_lng weight rolling_excursion_rate cumulative_excursion_time",
        "bool": "qr_verified rfid_scanned seal_intact door_open is_fraud_ground_truth is_masked is_suspicious_genuine is_fraud_detected duplicate_serial",
        "uint": "batch_tx_index",
    },
}
ARROW_TYPES = {
    "text": pa.large_string(), "float": pa.float64(), "int": pa.int64(), "uint": pa.uint32(),
    "bool": pa.bool_(), "date": pa.date32(), "timestamp": pa.timestamp("us"),
}
KEYS = {
    "entities": ["entity_id"], "medicines": ["medicine_id"], "batches": ["batch_id"],
    "fraud_events": ["batch_id"], "transactions": ["batch_id", "leg", "event_type"],
}
NULLABLE = {
    "entities": {"sfda_gmp_status", "import_certificate", "export_certificate", "customs_clearance",
                 "batch_release_certificate"},
    "fraud_events": {"fraud_type"},
    "transactions": {"gps_lat", "gps_lng", "fraud_type"},
}
DATE_FORMATS = {
    "date": ("%Y-%m-%d", r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"),
    "timestamp": ("%Y-%m-%dT%H:%M:%S", r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$"),
}
# These are domain checks, not cutoffs estimated from readings or fraud labels.
RANGES = {
    "entities": {"latitude": (-90, 90), "longitude": (-180, 180), "audit_score": (0, 100),
                 "years_of_operation": (0, None)},
    "medicines": {"shelf_life_days": (1, None), "price": (0, None)},
    "batches": {"quantity": (0, None)},
    "transactions": {"leg": (0, None), "batch_tx_index": (1, None), "weight": (0, None),
                     "gps_lat": (-90, 90), "gps_lng": (-180, 180), "rolling_excursion_rate": (0, 1)},
}


class CleaningError(ValueError):
    """A source value cannot be repaired without guessing."""


def category_domains(config):
    """Get the canonical spellings from the generator configuration and datasheet."""
    countries = config["countries"]
    fraud_types = list(config["fraud"]["type_distribution"])
    return {
        "entities": {
            "country": list(countries),
            "regulator": [country["regulator"] for country in countries.values()],
            "enforcement_level": [country["enforcement_level"] for country in countries.values()],
            "city": [hub for country in countries.values() for hub in country["hubs"]],
            "entity_type": sorted({name for country in countries.values() for name in country["entities"]}),
            "license_status": ["active", "expired", "suspended"],
            "sfda_gmp_status": ["pass", "pending"],
        },
        "medicines": {"drug_type": list(config["storage_ranges"])},
        "batches": {"country_of_origin": list(countries)},
        "fraud_events": {"fraud_type": fraud_types},
        "transactions": {
            "country": list(countries),
            "event_type": ["manufacturing", "quality_test", "packaging", "warehouse_in",
                           "shipment", "distributor_receipt", "pharmacy_receipt", "sale"],
            "fraud_type": fraud_types,
        },
    }


def _count(mask):
    return pc.sum(mask).as_py() or 0


def _reject(mask, context, reason):
    count = _count(mask)
    if count:
        first = pc.indices_nonzero(mask)[0].as_py()
        raise CleaningError(f"{context}: {count:,} {reason}. First position in block: {first:,}.")


def _parse_date(values, kind, context):
    expected = ARROW_TYPES[kind]
    if pa.types.is_date(values.type) or pa.types.is_timestamp(values.type):
        allowed = pa.types.is_date(values.type) if kind == "date" else (
            pa.types.is_timestamp(values.type) and values.type.tz is None
        )
        if not allowed:
            raise CleaningError(f"{context}: incompatible date or timestamp type {values.type}.")
        converted = pc.cast(values, expected, safe=True)
        _reject(pc.not_equal(pc.cast(converted, values.type), values), context, "lossy date conversions")
        if kind == "timestamp":
            _reject(pc.not_equal(pc.floor_temporal(converted, unit="second"), converted),
                    context, "timestamps with sub-second precision")
        return converted
    if not (pa.types.is_string(values.type) or pa.types.is_large_string(values.type)):
        raise CleaningError(f"{context}: expected ISO text or an already typed date or timestamp.")
    spelling, pattern = DATE_FORMATS[kind]
    parsed = pc.strptime(values, format=spelling, unit="s", error_is_null=True)
    same_date = pc.equal(pc.cast(pc.strftime(parsed, format=spelling), values.type), values)
    valid = pc.and_(pc.match_substring_regex(values, pattern), pc.fill_null(same_date, False))
    _reject(pc.invert(valid), context, "invalid ISO date or timestamp values")
    return pc.cast(parsed, expected)


def _clean_column(values, kind, nullable, canonical, context):
    expected = ARROW_TYPES[kind]
    if pa.types.is_dictionary(values.type):
        values = pc.dictionary_decode(values)
    if pa.types.is_null(values.type):
        return pc.cast(values, expected), 0, 0

    text = pa.types.is_string(values.type) or pa.types.is_large_string(values.type)
    if kind == "text":
        if not text:
            raise CleaningError(f"{context}: text expected. Identifier and category values cannot be inferred.")
        values = pc.cast(values, expected)
        trimmed = pc.utf8_trim_whitespace(values)
        blanks = _count(pc.equal(trimmed, ""))
        if nullable:
            values = pc.if_else(pc.equal(trimmed, ""), None, values)
        else:
            _reject(pc.equal(trimmed, ""), context, "blank values")
        if canonical is None:
            _reject(pc.not_equal(values, trimmed), context, "values with ambiguous surrounding whitespace")
            return values, 0, blanks

        domain = pa.array(canonical, type=expected)
        normalized = pc.utf8_lower(pc.utf8_trim_whitespace(values))
        index = pc.index_in(normalized, value_set=pc.utf8_lower(domain))
        _reject(pc.and_(pc.is_valid(values), pc.is_null(index)), context, "unknown categories")
        repaired = pc.take(domain, index)
        return repaired, _count(pc.not_equal(values, repaired)), blanks

    if kind in DATE_FORMATS:
        return _parse_date(values, kind, context), 0, 0
    if kind == "bool" and not pa.types.is_boolean(values.type):
        if text:
            normalized = pc.utf8_lower(pc.utf8_trim_whitespace(pc.cast(values, pa.large_string())))
            tokens = pa.array(["false", "0", "true", "1"], type=pa.large_string())
            index = pc.index_in(normalized, value_set=tokens)
            _reject(pc.and_(pc.is_valid(values), pc.is_null(index)), context, "ambiguous Boolean values")
            return pc.greater_equal(index, 2), 0, 0
        if pa.types.is_integer(values.type):
            _reject(pc.and_(pc.not_equal(values, 0), pc.not_equal(values, 1)), context, "invalid Boolean values")
            return pc.equal(values, 1), 0, 0
        raise CleaningError(f"{context}: expected a Boolean or an unambiguous 0/1 or false/true spelling.")

    if kind in {"float", "int", "uint"}:
        if text:
            values = pc.utf8_trim_whitespace(values)
        elif not (pa.types.is_integer(values.type) or pa.types.is_floating(values.type)):
            raise CleaningError(f"{context}: expected a numeric type or numeric text.")
    converted = pc.cast(values, expected, safe=True)
    if kind == "float":
        _reject(pc.is_inf(converted), context, "infinite values")
        missing_markers = _count(pc.is_nan(converted))
        if missing_markers:
            return pc.if_else(pc.is_nan(converted), None, converted), 0, missing_markers
    return converted, 0, 0


def _kind_map(name):
    return {column: kind for kind, columns in COLUMN_TYPES[name].items() for column in columns.split()}


def validate_schema(name, schema):
    """Reject missing, additional or repeated names before reading or writing data."""
    expected = set(_kind_map(name))
    actual = set(schema.names)
    if expected != actual or len(actual) != len(schema.names):
        raise CleaningError(f"{name}: missing columns {sorted(expected - actual)}, "
                            f"unexpected columns {sorted(actual - expected)}, "
                            f"duplicate names {len(schema.names) - len(actual)}.")


def clean_block(name, block, domains, audit=None):
    """Coerce known encodings and require keys and non-optional fields to be complete."""
    kinds = _kind_map(name)
    arrays = []
    for column in block.schema.names:
        context = f"{name}.{column}"
        values = block[column]
        nullable = column in NULLABLE.get(name, ())
        try:
            cleaned, normalized, markers = _clean_column(
                values, kinds[column], nullable, domains.get(name, {}).get(column), context
            )
        except pa.ArrowException as error:
            raise CleaningError(f"{context}: invalid or lossy type conversion. {error}") from error
        if cleaned.null_count and not nullable:
            raise CleaningError(f"{context}: {cleaned.null_count:,} missing required values.")
        if audit is not None:
            audit["type_converted_rows"][column] += len(values) - values.null_count if values.type != cleaned.type else 0
            audit["normalized_category_values"][column] += normalized
            audit["missing_markers_to_null"][column] += markers
            audit["nulls_preserved"][column] += cleaned.null_count
        arrays.append(cleaned)
    return pa.RecordBatch.from_arrays(arrays, names=block.schema.names)


def check_references(name, block, references):
    """Require each foreign ID to exist in its validated parent set."""
    for column, parent_ids in references.items():
        _reject(pc.invert(pc.is_in(block[column], value_set=parent_ids)), f"{name}.{column}", "missing parent IDs")


def validate_values(name, block):
    """Check fixed domains and relations within each row."""
    for column, (lower, upper) in RANGES.get(name, {}).items():
        _reject(pc.less(block[column], lower), f"{name}.{column}", f"values below {lower}")
        if upper is not None:
            _reject(pc.greater(block[column], upper), f"{name}.{column}", f"values above {upper}")
    if name == "medicines":
        _reject(pc.greater(block["storage_min"], block["storage_max"]), name, "reversed storage limits")
    if name == "batches":
        _reject(pc.greater(block["production_date"], block["expiry_date"]), name, "expiry dates before production")
    if name in {"transactions", "fraud_events"}:
        _reject(pc.not_equal(pc.is_valid(block["fraud_type"]), block["is_fraud_ground_truth"]),
                name, "rows where fraud_type presence disagrees with the ground-truth label")
    if name == "transactions":
        for column in ("previous_hash", "current_hash"):
            _reject(pc.invert(pc.match_substring_regex(block[column], "^[0-9a-f]{64}$")),
                    f"{name}.{column}", "malformed ledger hashes")


def _duplicate_positions(name, parquet, domains, batch_size):
    """Find repeated canonical keys, then verify only those rows against the full raw records."""
    key = KEYS[name]
    keys = pa.Table.from_batches([
        clean_block(name, block, domains) for block in parquet.iter_batches(batch_size=batch_size, columns=key)
    ]).to_pandas(types_mapper=pd.ArrowDtype)
    matches = keys.loc[keys.duplicated(key, keep=False)]
    if matches.empty:
        return np.array([], dtype=np.int64)
    positions = matches.index.to_numpy()
    candidates = {}
    offset = 0
    for block in parquet.iter_batches(batch_size=batch_size):
        left, right = positions.searchsorted([offset, offset + len(block)])
        for position in positions[left:right]:
            candidates[position] = block.slice(int(position - offset), 1)
        offset += len(block)

    drop = []
    for _, group in matches.groupby(key, sort=False):
        first, *repeats = group.index
        for position in repeats:
            if not candidates[first].equals(candidates[position]):
                raise CleaningError(f"{name}: conflicting records with the same key at rows {first} and {position}.")
            drop.append(position)
    return np.array(sorted(drop), dtype=np.int64)


def clean_parquet(name, source, destination, domains, references=None, batch_size=50_000):
    """Clean a table in bounded batches. The caller should provide a staging path."""
    if source.resolve() == destination.resolve():
        raise CleaningError("A cleaned output must use a different path from its source.")
    audit = {field: Counter() for field in (
        "type_converted_rows", "normalized_category_values", "missing_markers_to_null", "nulls_preserved"
    )}
    references = references or {}
    with pq.ParquetFile(source) as parquet:
        validate_schema(name, parquet.schema_arrow)
        drops = _duplicate_positions(name, parquet, domains, batch_size)
        kinds = _kind_map(name)
        schema = pa.schema([(column, ARROW_TYPES[kinds[column]]) for column in parquet.schema_arrow.names])
        offset = written = 0
        with pq.ParquetWriter(destination, schema, compression="zstd") as writer:
            for block in parquet.iter_batches(batch_size=batch_size):
                end = offset + len(block)
                start_drop, end_drop = drops.searchsorted([offset, end])
                if start_drop != end_drop:
                    keep = np.ones(len(block), dtype=bool)
                    keep[drops[start_drop:end_drop] - offset] = False
                    block = block.filter(pa.array(keep))
                offset = end
                cleaned = clean_block(name, block, domains, audit)
                validate_values(name, cleaned)
                check_references(name, cleaned, references)
                writer.write_batch(cleaned)
                written += len(cleaned)
        assert offset == parquet.metadata.num_rows and written == offset - len(drops)
    return {"rows_before": offset, "rows_after": written, "verified_duplicates_removed": len(drops), **audit}

