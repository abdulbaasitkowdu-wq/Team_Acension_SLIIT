# TRACE-X schema summary

This structural review covers the five released Parquet files in `Phase1_Dataset/dataset/`. The [data understanding notebook](../notebooks/01_Data_Understanding.ipynb) shows the first five rows of each table when run locally and contains the checks used to produce this report. The expected keys and target came from the [dataset understanding report](dataset_understanding.md) and were checked against the release.

## Shapes and duplicate records

| Table | Rows | Columns | Duplicate records |
| --- | --- | --- | --- |
| entities | 2,048 | 21 | 0 |
| medicines | 300 | 7 | 0 |
| batches | 60,000 | 9 | 0 |
| fraud_events | 60,000 | 4 | 0 |
| transactions | 1,201,800 | 27 | 0 |

The four smaller tables were checked for exact full-row duplicates. The transactions file has zero full-row duplicates because its verified composite key has a different value on every row. The notebook reads at most 50,000 transaction rows per batch and keeps compact arrays for exact whole-file key checks.

## Keys and relationships

The verified logical primary keys are `entities.entity_id`, `medicines.medicine_id`, `batches.batch_id`, and `fraud_events.batch_id`. Transactions has no separate transaction ID. `(batch_id, leg, event_type)` identifies a lifecycle event, and `(batch_id, batch_tx_index)` is an alternate key. Both combinations are complete and unique in this release. These are observed keys in the data.

| Child | Parent | Relationship | Child rows | Null references | Unmatched non-null references | Unreferenced parent IDs |
| --- | --- | --- | --- | --- | --- | --- |
| batches.medicine_id | medicines.medicine_id | many-to-one | 60,000 | 0 | 0 | 0 |
| batches.manufacturer_id | entities.entity_id (manufacturers) | many-to-one | 60,000 | 0 | 0 | 0 |
| fraud_events.batch_id | batches.batch_id | one-to-one | 60,000 | 0 | 0 | 0 |
| transactions.batch_id | batches.batch_id | many-to-one | 1,201,800 | 0 | 0 | 0 |

The ledger has 1 all-zero previous hashes, 1,201,799 nonzero previous hashes that point to a stored current hash, and 0 nonzero previous hashes without a match. The counts describe hash references only. They do not verify the order or integrity of the ledger.

### Identifier counts

| Table | Identifier | Distinct non-null | Missing rows | Repeated rows |
| --- | --- | --- | --- | --- |
| entities | entity_id | 2,048 | 0 | 0 |
| entities | license_number | 2,040 | 0 | 8 |
| medicines | medicine_id | 300 | 0 | 0 |
| batches | batch_id | 60,000 | 0 | 0 |
| batches | manufacturer_id | 23 | 0 | 59,977 |
| batches | medicine_id | 300 | 0 | 59,700 |
| batches | serial_number | 60,000 | 0 | 0 |
| batches | lot_number | 15,956 | 0 | 44,044 |
| fraud_events | batch_id | 60,000 | 0 | 0 |
| transactions | (batch_id, leg, event_type) | 1,201,800 | 0 | 0 |
| transactions | (batch_id, batch_tx_index) | 1,201,800 | 0 | 0 |
| transactions | current_hash | 1,201,800 | 0 | 0 |
| transactions | previous_hash | 1,201,800 | 0 | 0 |
| transactions | batch_id | 60,000 | 0 | 1,141,800 |
| transactions | sensor_id | 8,999 | 0 | 1,192,801 |

Distinct counts exclude missing values. Repeated rows count each additional occurrence of an identifier.

## Target column

`transactions.is_fraud_ground_truth` is present as a Boolean column with 0 missing values. It is the documented transaction-level target. This check covers presence, type, and completeness.

## Column types, missing values, and ranges

Types are the types read from Parquet. Missing values count nulls and floating-point NaNs separately. Numerical summaries use finite values and report the sample standard deviation. Dates and timestamps are stored as text in this release. Date ranges come from an in-memory format check. The event timestamp does not specify a timezone.

### entities

| Column | Stored type | Null | NaN | Missing total |
| --- | --- | --- | --- | --- |
| entity_id | large_string | 0 | 0 | 0 |
| entity_type | large_string | 0 | 0 | 0 |
| country | large_string | 0 | 0 | 0 |
| regulator | large_string | 0 | 0 | 0 |
| enforcement_level | large_string | 0 | 0 | 0 |
| city | large_string | 0 | 0 | 0 |
| latitude | double | 0 | 0 | 0 |
| longitude | double | 0 | 0 | 0 |
| license_number | large_string | 0 | 0 | 0 |
| license_status | large_string | 0 | 0 | 0 |
| license_expiry | large_string | 0 | 0 | 0 |
| gmp_compliant | bool | 0 | 0 | 0 |
| pics_compliant | bool | 0 | 0 | 0 |
| sfda_gmp_status | large_string | 1,361 | 0 | 1,361 |
| audit_score | double | 0 | 0 | 0 |
| years_of_operation | int64 | 0 | 0 | 0 |
| is_importer | bool | 0 | 0 | 0 |
| import_certificate | bool | 1,760 | 0 | 1,760 |
| export_certificate | bool | 1,760 | 0 | 1,760 |
| customs_clearance | bool | 1,760 | 0 | 1,760 |
| batch_release_certificate | bool | 1,760 | 0 | 1,760 |

Numerical summary

| Column | Finite count | Min | Max | Mean | Sample std | Infinite |
| --- | --- | --- | --- | --- | --- | --- |
| latitude | 2,048 | 20.9453 | 34.3562 | 28.5833 | 4.38953 | 0 |
| longitude | 2,048 | 38.7184 | 74.6774 | 61.6333 | 13.6734 | 0 |
| audit_score | 2,048 | 12.2 | 100 | 77.627 | 14.3735 | 0 |
| years_of_operation | 2,048 | 1 | 29 | 14.6895 | 8.28099 | 0 |

Date or timestamp ranges

| Column | Earliest | Latest | Invalid non-null strings |
| --- | --- | --- | --- |
| license_expiry | 2023-06-15 | 2026-06-17 | 0 |

### medicines

| Column | Stored type | Null | NaN | Missing total |
| --- | --- | --- | --- | --- |
| medicine_id | large_string | 0 | 0 | 0 |
| drug_type | large_string | 0 | 0 | 0 |
| storage_min | int64 | 0 | 0 | 0 |
| storage_max | int64 | 0 | 0 | 0 |
| is_cold_chain | bool | 0 | 0 | 0 |
| shelf_life_days | int64 | 0 | 0 | 0 |
| price | double | 0 | 0 | 0 |

Numerical summary

| Column | Finite count | Min | Max | Mean | Sample std | Infinite |
| --- | --- | --- | --- | --- | --- | --- |
| storage_min | 300 | 2 | 15 | 6.36333 | 5.48192 | 0 |
| storage_max | 300 | 8 | 25 | 14.97 | 8.37514 | 0 |
| shelf_life_days | 300 | 180 | 730 | 451.183 | 210.885 | 0 |
| price | 300 | 1.3 | 85.32 | 16.363 | 13.2969 | 0 |

This table has no date or timestamp columns.

### batches

| Column | Stored type | Null | NaN | Missing total |
| --- | --- | --- | --- | --- |
| batch_id | large_string | 0 | 0 | 0 |
| medicine_id | large_string | 0 | 0 | 0 |
| manufacturer_id | large_string | 0 | 0 | 0 |
| country_of_origin | large_string | 0 | 0 | 0 |
| production_date | large_string | 0 | 0 | 0 |
| expiry_date | large_string | 0 | 0 | 0 |
| quantity | int64 | 0 | 0 | 0 |
| serial_number | large_string | 0 | 0 | 0 |
| lot_number | large_string | 0 | 0 | 0 |

Numerical summary

| Column | Finite count | Min | Max | Mean | Sample std | Infinite |
| --- | --- | --- | --- | --- | --- | --- |
| quantity | 60,000 | 42 | 445,625 | 4,943.42 | 7,016.22 | 0 |

Date or timestamp ranges

| Column | Earliest | Latest | Invalid non-null strings |
| --- | --- | --- | --- |
| production_date | 2024-01-01 | 2025-12-11 | 0 |
| expiry_date | 2024-06-29 | 2027-12-11 | 0 |

### fraud_events

| Column | Stored type | Null | NaN | Missing total |
| --- | --- | --- | --- | --- |
| batch_id | large_string | 0 | 0 | 0 |
| is_fraud_ground_truth | bool | 0 | 0 | 0 |
| fraud_type | large_string | 53,904 | 0 | 53,904 |
| in_ring | bool | 0 | 0 | 0 |

This table has no numerical columns.

This table has no date or timestamp columns.

### transactions

| Column | Stored type | Null | NaN | Missing total |
| --- | --- | --- | --- | --- |
| batch_id | large_string | 0 | 0 | 0 |
| country | large_string | 0 | 0 | 0 |
| event_type | large_string | 0 | 0 | 0 |
| leg | int64 | 0 | 0 | 0 |
| timestamp | large_string | 0 | 0 | 0 |
| temperature | double | 0 | 0 | 0 |
| humidity | double | 0 | 0 | 0 |
| gps_lat | double | 42,322 | 0 | 42,322 |
| gps_lng | double | 42,322 | 0 | 42,322 |
| qr_verified | bool | 0 | 0 | 0 |
| rfid_scanned | bool | 0 | 0 | 0 |
| seal_intact | bool | 0 | 0 | 0 |
| weight | double | 0 | 0 | 0 |
| door_open | bool | 0 | 0 | 0 |
| battery_level | int64 | 0 | 0 | 0 |
| sensor_id | large_string | 0 | 0 | 0 |
| is_fraud_ground_truth | bool | 0 | 0 | 0 |
| fraud_type | large_string | 1,079,544 | 0 | 1,079,544 |
| is_masked | bool | 0 | 0 | 0 |
| is_suspicious_genuine | bool | 0 | 0 | 0 |
| is_fraud_detected | bool | 0 | 0 | 0 |
| previous_hash | large_string | 0 | 0 | 0 |
| current_hash | large_string | 0 | 0 | 0 |
| batch_tx_index | uint32 | 0 | 0 | 0 |
| rolling_excursion_rate | double | 0 | 0 | 0 |
| duplicate_serial | bool | 0 | 0 | 0 |
| cumulative_excursion_time | double | 0 | 0 | 0 |

Numerical summary

| Column | Finite count | Min | Max | Mean | Sample std | Infinite |
| --- | --- | --- | --- | --- | --- | --- |
| leg | 1,201,800 | 0 | 3 | 1.00161 | 1.00032 | 0 |
| temperature | 1,201,800 | -0.7 | 31.55 | 11.411 | 7.44756 | 0 |
| humidity | 1,201,800 | 30 | 70 | 49.993 | 11.5435 | 0 |
| gps_lat | 1,159,478 | 21 | 34 | 27.4963 | 3.75187 | 0 |
| gps_lng | 1,159,478 | 39 | 74 | 56.4926 | 10.1071 | 0 |
| weight | 1,201,800 | 8.566 | 11.407 | 9.99964 | 0.299773 | 0 |
| battery_level | 1,201,800 | 20 | 99 | 59.5168 | 23.1035 | 0 |
| batch_tx_index | 1,201,800 | 1 | 32 | 12.5129 | 8.32413 | 0 |
| rolling_excursion_rate | 1,201,800 | 0 | 1 | 0.0833967 | 0.138147 | 0 |
| cumulative_excursion_time | 1,201,800 | 0 | 27,665 | 688.445 | 1,275.83 | 0 |

Date or timestamp ranges

| Column | Earliest | Latest | Invalid non-null strings |
| --- | --- | --- | --- |
| timestamp | 2024-01-01T05:25:46 | 2025-12-30T22:38:31 | 0 |

The original Parquet files were opened read-only. No datasets were cleaned, merged, or written. No feature-target relationships or preprocessing parameters were evaluated.
