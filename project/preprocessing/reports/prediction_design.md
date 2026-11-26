# Transaction-level fraud prediction design

## Objective and unit of prediction

For each recorded lifecycle event, estimate the chance that it belongs to a batch labelled fraudulent in TRACE-X. One prediction corresponds to one row of `transactions.parquet`. Use `(batch_id, leg, event_type)` as the row key. The schema review verified that the key is complete and unique. The label applies to batch membership throughout the lifecycle. The release does not identify which transaction first contained the fraud. [Dataset understanding](dataset_understanding.md#5-correct-target) · [Schema summary](schema_summary.md#keys-and-relationships)

## Prediction timestamp

Set the offline prediction timestamp to **`transactions.timestamp`** for the row being scored. The proposed scoring point is when the current lifecycle event is recorded, with any approved readings or verification results already available for that record. Only information available by that point can enter the prediction. Use earlier events for history, and include the current event in a calculation only when its relevant fields have arrived. A timestamp tie alone cannot establish which record was available first. [Dataset understanding, prediction time](dataset_understanding.md#7-what-is-available-at-prediction-time) · [Generator, event fields and timestamp format](../Phase1_Dataset/code/generator.py#L274)

The release stores timestamps to the second and provides no timezone, ingestion clock, or arrival time for individual fields. The recorded event time is therefore a proxy for scoring time. If a field arrives later in a live workflow, hold it out of this scoring point until its availability can be established. Use the raw timestamp as the split clock. Keep calendar features out of the initial input list because the generator applies fraud campaigns by production date. [Schema summary, transaction timestamps](schema_summary.md#transactions) · [Generator, campaign assignment](../Phase1_Dataset/code/generator.py#L195)

## Target and label availability

**Use `transactions.is_fraud_ground_truth`.** The datasheet documents it and the release stores it as a complete Boolean. Encode `False` as `0` for an event in a genuine batch and `True` as `1` for an event in a fraudulent batch. [Datasource labels](../Phase1_Dataset/DATASHEET.md#L52) · [Schema summary, target column](schema_summary.md#target-column)

- **In the synthetic release**, the generator assigns fraud once per batch before it creates transaction events and copies the batch label to those events. The label is available offline for supervised learning and evaluation. [Generator, batch assignment](../Phase1_Dataset/code/generator.py#L184) · [Generator, transaction labels](../Phase1_Dataset/code/generator.py#L225)
- **At scoring time**, treat ground truth as a later outcome. In a live setting its availability would begin when a separate review confirms the outcome and records the time of confirmation. TRACE-X gives no confirmation timestamp, review delay, or evidence that labels would have been available by any proposed calendar cutoff. `is_fraud_detected` is a separately sampled outcome that uses ground truth and has no detection timestamp. Keep it outside inputs. [Generator, detection flag](../Phase1_Dataset/code/generator.py#L299) · [Schema summary, transaction fields](schema_summary.md#transactions)
- **`fraud_events` is optional for target preparation.** The required label is already on each transaction. The earlier release review found zero disagreements with the batch-level label, so the table can serve as an independent check. Its `in_ring` flag can support a later overlap audit. [Dataset understanding, verified label match](dataset_understanding.md#5-correct-target) · [Schema summary, relationships](schema_summary.md#keys-and-relationships)
- **One batch fraud decision affects multiple transaction rows.** A batch contributes multiple legs or lifecycle steps, and all its records inherit the same label. The preparation run confirmed that each of the 60,000 batches has only one ground-truth value across its transactions. There is one fraud record per batch, with no separate fraud incident ID for deciding whether several batches share one real-world fraud event. Future chronological splits must keep each batch intact and check campaign and ring overlap separately. [Generator, fraud record and lifecycle](../Phase1_Dataset/code/generator.py#L202) · [Schema summary, keys and relationships](schema_summary.md#keys-and-relationships) · [Dataset understanding, split strategy](dataset_understanding.md#10-recommended-preprocessing-strategy)

## Feature audit

[feature_audit.csv](feature_audit.csv) lists all 68 released columns across the five tables. It records the table, exact column name, stored type, primary category, planned use, reason, and evidence. Source paths in the CSV are relative to `reports/`.

| Category | Columns | How to use them |
| --- | ---: | --- |
| Safe input features | 13 | Seven current-event fields are eligible if present when scoring. The other six are batch or catalogue fields that require a verifiable version available at that time. |
| Join identifiers | 14 | Keep these for keys, grouping, references, or ledger checks as specified. A raw identifier stays outside model inputs. The current `event_type` and `leg` have a second role as row-key components. |
| Target and label-related columns | 8 | Use the transaction ground-truth column for the binary target. Keep the other fields for label, overlap, or evaluation checks. |
| Future-information columns | 2 | Hold out `duplicate_serial` and `cumulative_excursion_time`. Their computation is undocumented, so they could use later observations. This is a potential look-ahead risk. |
| Suspected synthetic leakage columns | 14 | Hold out simulator shortcuts such as seal, QR, GPS dropout, and fraud-assignment inputs from the initial design. Keep the event timestamp for chronology. |
| Columns requiring further investigation | 17 | Hold out fields with unresolved meaning, timing, or transfer value. This includes certificate fields, mutable snapshots, and geography fields that may proxy manufacturers or jurisdiction. |

The initial current-event inputs are `event_type`, `leg`, `humidity`, `rfid_scanned`, `weight`, `door_open`, and `battery_level`, subject to the timing rule above. The audit decisions use the documented source rules. Their predictive value was not tested on any period. [Generator, simulated evidence](../Phase1_Dataset/code/generator.py#L238) · [Dataset understanding, synthetic shortcuts](dataset_understanding.md#9-synthetic-shortcuts-that-can-reveal-the-target)

The generator sets batch expiry to production date plus the medicine's shelf life. Giving a model both expiry and shelf life could reconstruct the production date the simulator uses to apply campaign boosts. Hold out expiry from the initial inputs even if the planned date was known at scoring. [Generator, batch dates](../Phase1_Dataset/code/generator.py#L149) · [Generator, campaign assignment](../Phase1_Dataset/code/generator.py#L195)

## Prepared target and verification

The generated `processed/transaction_target.parquet` contains 1,201,800 rows with the three transaction key fields and `is_fraud_ground_truth` encoded as `uint8`. I read the output back and verified every key and encoded label against the source. Both values occur, there are no missing labels, and the source files' checksums matched before and after preparation. This phase prepared only the target. No feature table, data split, or model was produced.

### Reproduce the target in Jupyter

Run this Python cell from the project root or `notebooks/`. It reads only the key and documented label in batches.

```python
from pathlib import Path
from tempfile import TemporaryDirectory

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

# Run from the project root or notebooks folder.
current = Path.cwd()
root = next(path for path in (current, *current.parents) if (path / "AGENTS.md").is_file())
source_path = root / "Phase1_Dataset" / "dataset" / "transactions.parquet"
target_path = root / "processed" / "transaction_target.parquet"
target_path.parent.mkdir(exist_ok=True)
key = ["batch_id", "leg", "event_type"]
label = "is_fraud_ground_truth"
columns = key + [label]
batch_size = 50_000

with pq.ParquetFile(source_path) as source, TemporaryDirectory(dir=target_path.parent) as staging:
    assert source.schema_arrow.field(label).type == pa.bool_()
    schema = pa.schema([source.schema_arrow.field(name) for name in key] + [pa.field(label, pa.uint8())])
    staged = Path(staging) / target_path.name
    batches_by_label = {False: set(), True: set()}
    rows = 0
    with pq.ParquetWriter(staged, schema) as writer:
        for batch in source.iter_batches(columns=columns, batch_size=batch_size):
            assert all(batch[name].null_count == 0 for name in columns)
            labels = batch[label]
            for value, batch_ids in batches_by_label.items():
                selected = pc.filter(batch["batch_id"], pc.equal(labels, value))
                batch_ids.update(pc.unique(selected).to_pylist())
            # Preserve transaction identity and encode the original Boolean label.
            writer.write_batch(pa.RecordBatch.from_arrays(
                [batch[name] for name in key] + [pc.cast(labels, pa.uint8())], schema=schema
            ))
            rows += len(batch)

    assert rows == source.metadata.num_rows
    assert all(batches_by_label.values()), "Expected both binary labels."
    assert batches_by_label[False].isdisjoint(batches_by_label[True]), "Conflicting batch labels."
    # Read the saved data back and compare every key and label with the source.
    with pq.ParquetFile(staged) as saved:
        assert saved.schema_arrow.equals(schema) and saved.metadata.num_rows == rows
        for original, encoded in zip(
            source.iter_batches(columns=columns, batch_size=batch_size),
            saved.iter_batches(batch_size=batch_size),
            strict=True,
        ):
            assert all(original[name].equals(encoded[name]) for name in key)
            assert encoded[label].equals(pc.cast(original[label], pa.uint8()))

    staged.replace(target_path)

batch_count = sum(len(ids) for ids in batches_by_label.values())
print(f"Verified {rows:,} binary targets across {batch_count:,} batches.")
```

