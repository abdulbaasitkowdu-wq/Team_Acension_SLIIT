# Transaction data integration

The [executed notebook](../notebooks/05_Data_Integration.ipynb) built an integrated DataFrame with 1,201,800 rows and 12 columns. There is one row per `(batch_id, leg, event_type)`. The original transaction identities and timestamps match the frozen split manifest exactly.

## Join validation

| Join | Relationship | Rows before | Rows after | Unmatched keys |
| --- | --- | ---: | ---: | ---: |
| batches.manufacturer_id to entities.entity_id | many-to-one | 60,000 | 60,000 | 0 |
| batches.medicine_id to medicines.medicine_id | many-to-one | 60,000 | 60,000 | 0 |
| transactions.batch_id to batches.batch_id | many-to-one | 1,201,800 | 1,201,800 | 0 |

Each parent key was complete and unique before the join. No many-to-many expansion occurred, and there were zero duplicate transaction keys before or after the joins. The entity lookup confirmed manufacturer roles.

## Feature fields and timing

The model input list is `event_type`, `leg`, `humidity`, `rfid_scanned`, `weight`, `door_open`, `battery_level`, `storage_min`, `storage_max`, `is_cold_chain`. Keep `batch_id` and `timestamp` as metadata. Batch and entity lookups establish relationships and validate the event context. Their extra fields stay outside the feature table.

All 300 medicine records matched their configured storage rules. The generator creates the catalogue before events. In the released data, those limits reproduce the recorded storage excursion rate for all 1,201,800 rows using only current and earlier batch events. There were 0 events dated before batch production. This supports using the fixed storage specifications in the offline simulation. It does not verify live data delivery. [Generator](../Phase1_Dataset/code/generator.py#L320)

The release has no effective-date and availability history for changing fields. Licence, audit, compliance, certificates and price were withheld. A future versioned join must enforce that the version was both effective and known at scoring time. Production date, historical excursion calculations, and the other audit-only fields also stayed outside the feature table.

## Split and label handling

The matched manifest records 831,536 training, 161,976 validation, 170,960 test, and 37,328 boundary-excluded rows. Use the frozen assignments to select each split. All fraud outcomes remain separate, including the binary target. There was no feature-target analysis or model fitting.

Failure-path tests verified that duplicate parents, null or unmatched foreign keys, duplicate transaction IDs, and future batch dates stop the run. Disk space prevented a standalone Parquet export. The notebook creates the full DataFrame in memory.
