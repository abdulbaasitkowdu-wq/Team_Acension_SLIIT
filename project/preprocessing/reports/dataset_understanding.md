# TRACE-X dataset understanding

## 1. Purpose

TRACE-X simulates a pharmaceutical supply chain in Saudi Arabia and Pakistan. It provides examples of manufacturing, shipment, and other lifecycle events so we can study whether an event belongs to a fraudulent batch. The prediction unit is one transaction row. The underlying fraud decision is made once per batch, so several transaction rows can share the same answer. [Datasheet, overview and transactions](../Phase1_Dataset/DATASHEET.md#L1) · [Generator, batch labels and events](../Phase1_Dataset/code/generator.py#L184)

## 2. Is it synthetic?

Yes. The datasheet calls TRACE-X synthetic. The generator uses a configured random seed to create participants, medicines, batches, fraud labels, and event readings. The configured rates describe the simulation. They do not establish real-world fraud or detection rates. [Datasheet, overview](../Phase1_Dataset/DATASHEET.md#L1) · [Configuration, seed and fraud settings](../Phase1_Dataset/code/config.yaml#L1) · [Generator, main](../Phase1_Dataset/code/generator.py#L343)

The supplied code and the released files differ in scope. The release has two transaction fields the supplied generator does not write, `duplicate_serial` and `cumulative_excursion_time`. It also has `serial_number` and `lot_number` in `batches`, and `import_certificate`, `export_certificate`, `customs_clearance`, and `batch_release_certificate` in `entities`. I verified these names from the Parquet schemas. The descriptions of generation rules below refer to the supplied code. The release checks are identified separately. [Generator, entity fields](../Phase1_Dataset/code/generator.py#L55) · [Generator, batch fields](../Phase1_Dataset/code/generator.py#L155) · [Generator, transaction fields](../Phase1_Dataset/code/generator.py#L274)

## 3. The five tables

The row counts come from the released Parquet metadata and agree with the datasheet's table list. [Datasheet, files](../Phase1_Dataset/DATASHEET.md#L6)

| Table | Rows | What one row represents |
| --- | ---: | --- |
| `entities` | 2,048 | One supply-chain participant, such as a manufacturer, distributor, pharmacy, or regulator. |
| `medicines` | 300 | One medicine catalogue entry with a product type, storage limits, cold-chain status, shelf life, and price. |
| `batches` | 60,000 | One manufactured batch, linked to its medicine and manufacturer, with production date, expiry date, and quantity. |
| `fraud_events` | 60,000 | One hidden fraud record per batch, including genuine batches. It stores the ground-truth label, fraud type, and an `in_ring` flag. |
| `transactions` | 1,201,800 | One lifecycle event on one leg of a batch, with readings, verification signals, and evaluation labels. The lifecycle runs from manufacturing through sale. |

[Datasheet, entity and transaction fields](../Phase1_Dataset/DATASHEET.md#L16) · [Generator, medicines and batches](../Phase1_Dataset/code/generator.py#L123) · [Generator, fraud records and lifecycle](../Phase1_Dataset/code/generator.py#L202)

## 4. How fraud is generated

1. **Assign fraud to a batch.** The generator starts with a base score, increases it for a non-active manufacturer licence, lack of GMP compliance, a lower audit score, or a selected ring manufacturer, and adds a campaign boost when the batch's production date falls in a configured campaign window. It adds random noise, converts the score to a probability, and makes a random fraud decision. A fraudulent batch gets one of nine fraud types using the configured weights. In this code, `base_rate: 0.10` is printed for comparison. It does not set the realised fraud rate. [Configuration, fraud types](../Phase1_Dataset/code/config.yaml#L13) · [Generator, fraud assignment](../Phase1_Dataset/code/generator.py#L167)
2. **Copy the batch decision to its events.** The generator creates one to four legs per batch and repeats the eight lifecycle steps on each leg. Every event inherits the batch's ground-truth label and fraud type. The ring configuration lists dates and fraud types, but the supplied assignment function uses only country and entity type to sample ring members. It combines them into one set and applies the ring boost based on manufacturer membership. The separately configured temporal campaign windows are applied by production date. [Configuration, rings and campaigns](../Phase1_Dataset/code/config.yaml#L93) · [Generator, assignment and event loop](../Phase1_Dataset/code/generator.py#L167)
3. **Simulate evidence and hard cases.** On unmasked fraud rows, fake QR, counterfeit, and duplicate-batch fraud can fail QR verification. Tampering and theft can break seals. Cold-chain temperature fraud can push readings higher. Masked fraud rows skip those type-specific changes. Some genuine rows receive suspicious-looking readings or failed QR checks, and genuine cold-chain rows can also have simulated excursions. The extra GPS dropout rule applies to every fraud type, including masked rows, despite the setting name `mnar_missing_tampered`. [Configuration, cold chain and hard cases](../Phase1_Dataset/code/config.yaml#L28) · [Generator, evidence rules](../Phase1_Dataset/code/generator.py#L238)
4. **Simulate detection separately.** The generator gives each true fraud row a 65% chance of being marked detected under the supplied configuration. Genuine rows always receive false for `is_fraud_detected` in this code. [Configuration, detection rate](../Phase1_Dataset/code/config.yaml#L13) · [Generator, detection flag](../Phase1_Dataset/code/generator.py#L299)

## 5. Correct target

Use **`transactions.is_fraud_ground_truth`** as the binary target. A true value means that the event belongs to a batch labelled fraudulent by the simulation. It does not mark the moment fraud occurred. The read-only release check found zero missing transaction labels and zero disagreements with `fraud_events.is_fraud_ground_truth` after matching by `batch_id`. The source validator trains its example models against `is_fraud_detected` and uses a random row split. That example answers a different question and can put related rows in both sets. [Datasheet, labels](../Phase1_Dataset/DATASHEET.md#L49) · [Generator, inherited and detected labels](../Phase1_Dataset/code/generator.py#L225) · [Validator, target and split](../Phase1_Dataset/code/validate.py#L97)

## 6. Primary keys and foreign keys

These are logical keys verified in the released files. A primary key identifies a row. A foreign key links to a row in another table.

| Table | Primary key or verified row key | Foreign keys |
| --- | --- | --- |
| `entities` | `entity_id` | None in the five released tables. |
| `medicines` | `medicine_id` | None in the five released tables. |
| `batches` | `batch_id` | `medicine_id` → `medicines.medicine_id`. `manufacturer_id` → `entities.entity_id`, limited to manufacturer rows. |
| `fraud_events` | `batch_id` | `batch_id` → `batches.batch_id`. Each batch has one fraud record. |
| `transactions` | `(batch_id, leg, event_type)`. `(batch_id, batch_tx_index)` also uniquely identifies rows in this release. | `batch_id` → `batches.batch_id`. Each batch has multiple events. |

All listed keys had zero null key rows and zero duplicates. All listed foreign keys had zero null or unmatched values. Transactions reach medicine and manufacturer records through `batches`. There is no separate transaction ID or sensor table in the release. The hashes link events in a generated ledger chain. The supply-chain graph built in memory is not exported as a table or passed to event generation. [Generator, IDs and batches](../Phase1_Dataset/code/generator.py#L39) · [Generator, event keys and hashes](../Phase1_Dataset/code/generator.py#L274) · [Generator, graph and output files](../Phase1_Dataset/code/generator.py#L353) · [Validator, example joins](../Phase1_Dataset/code/validate.py#L44)

## 7. What is available at prediction time?

**Proposed scoring point:** score an event immediately after it is recorded and its event-time readings and verification results have arrived, before any fraud review result or later event is available. Use `timestamp` as the event clock for this offline study. The supplied sources do not establish ingestion times, delays, or a timezone for the written timestamp. Treat scoring-time availability as a project assumption and document it before implementing features. [Datasheet, transaction fields](../Phase1_Dataset/DATASHEET.md#L40) · [Generator, recorded fields and timestamp format](../Phase1_Dataset/code/generator.py#L274) · [Generator, timestamp export](../Phase1_Dataset/code/generator.py#L339)

At that point the candidate information is the current event type, leg, readings, and verification results that have arrived. A previously known batch record or medicine storage limit can be joined through the keys above. Use mutable information such as licence status, audit score, compliance status, price, and certificate status only if there is evidence that the value was available at that event's time. The release does not provide a dated history for those snapshots. For history, use earlier recorded events only. A feature that combines prior readings with the current reading is valid at the proposed scoring point if the current reading has arrived and the ordering is reliable. [Generator, entity attributes](../Phase1_Dataset/code/generator.py#L55) · [Generator, catalogue and batch fields](../Phase1_Dataset/code/generator.py#L123) · [Generator, cumulative rate](../Phase1_Dataset/code/generator.py#L320)

## 8. Columns and joins that could leak information

| Risk | What to do |
| --- | --- |
| Direct answer fields | Keep `is_fraud_ground_truth` separate from inputs. Exclude `fraud_type`, `is_fraud_detected`, `is_masked`, and `is_suspicious_genuine`. In the supplied code, a populated fraud type, detected fraud, or masked flag can identify a positive label, and a suspicious-genuine flag identifies a negative label. |
| Hidden fraud assignments | Keep `fraud_events`, including `in_ring`, out of feature joins. Its batch labels are suitable for checking the target. Ring information is suitable for overlap checks where the release supports them. |
| IDs and ledger links | Keep raw `batch_id`, `manufacturer_id`, `medicine_id`, `sensor_id`, `serial_number`, `lot_number`, `previous_hash`, and `current_hash` out of the baseline feature matrix. Use IDs for joins and grouping. Raw batch IDs can let a model remember repeated batch labels. The hash values connect the globally sorted ledger and use the batch ID, event type, timestamp, and prior hash. |
| Future information in summaries or joins | Exclude final event counts, full-batch averages, later verification results, and snapshots without verified scoring-time availability. Hold out `duplicate_serial` and `cumulative_excursion_time` until their construction is known. In particular, a duplicate flag could use a later occurrence, and a cumulative duration could use intervals that end after scoring. The supplied sources do not establish how these two release fields were built. |
| Existing transaction history fields | The supplied generator computes `batch_tx_index` in chronological order and `rolling_excursion_rate` from the cumulative fraction of current and earlier readings outside medicine storage limits. For the baseline, verify or rebuild them using event-time ordering and a rule for timestamp ties. Do not use later events to calculate either field. |

[Generator, labels and evidence](../Phase1_Dataset/code/generator.py#L184) · [Generator, hashes and history](../Phase1_Dataset/code/generator.py#L297) · [Datasheet, transaction fields](../Phase1_Dataset/DATASHEET.md#L40)

## 9. Synthetic shortcuts that can reveal the target

- **A broken seal is a one-way giveaway in the supplied code.** It starts true on every row and can become false only for unmasked tampering or theft fraud. That rule makes a false `seal_intact` sufficient to identify fraud in the code, while many fraud rows still have intact seals. [Generator, evidence rules](../Phase1_Dataset/code/generator.py#L243)
- **GPS dropout, failed QR checks, and temperature bands carry injected signal.** The code forces extra GPS blanks on fraud rows, including masked ones. Genuine rows can also have missing GPS or failed QR checks. The code draws temperature fraud on cold-chain products from a special range. These can make a model learn simulator rules. Their usefulness and strength in the release were not measured in this review. [Generator, evidence rules](../Phase1_Dataset/code/generator.py#L238)
- **Manufacturer and calendar patterns are built into fraud assignment.** Licence status, GMP compliance, audit score, selected manufacturers, and production-date campaign windows change the chance that a batch receives a positive label. Raw identifiers and narrow date bins can help a model memorise these patterns. The configured rings and campaigns are separate mechanisms. [Configuration, rings and campaigns](../Phase1_Dataset/code/config.yaml#L93) · [Generator, assignment score](../Phase1_Dataset/code/generator.py#L184)
- **Geography is simplified.** Every generated transaction copies the batch's country of origin, and available GPS coordinates are randomly sampled from fixed ranges. The datasheet also discloses a cross-border generation bug and reports no genuine multi-country batch transit. The release does not support validating a model's ability to spot cross-border routes. [Generator, geography fields](../Phase1_Dataset/code/generator.py#L274) · [Datasheet, known issues](../Phase1_Dataset/DATASHEET.md#L87)

The validator's mutual-information chart uses a limited feature list and the detected-fraud label. It does not resolve these concerns for a ground-truth fraud model. [Validator, features and audit](../Phase1_Dataset/code/validate.py#L80)

## 10. Recommended preprocessing strategy

1. **Start from the released Parquet files in Python and Jupyter.** Keep the source files read-only. Parse and check event timestamps, confirm schemas and keys, and keep the target separate. For each many-to-one join, assert that the lookup key is unique, the transaction row count is unchanged, and unmatched rows are accounted for. Avoid joining hidden fraud labels into the feature table.
2. **Split by time and keep batches intact.** Use an early training period, a later validation period, and the latest period for the final test. Choose and record cutoffs before developing features. A read-only check found **750 batches spanning the documented 2025-09-01 cutoff** and **23 manufacturers with events on both sides**. A row split at that date would share these batches across sets and would not be manufacturer-disjoint. Set boundaries using whole batch time spans and explicitly account for boundary-spanning batches that cannot fit entirely in a period. Use event timestamps to verify that each split is strictly later than the previous one. The actual released event range is **2024-01-01 05:25:46 through 2025-12-30 22:38:31**. The configured end date does not establish test coverage through June 2026. [Datasheet, split](../Phase1_Dataset/DATASHEET.md#L82) · [Configuration, date bounds and split](../Phase1_Dataset/code/config.yaml#L1) · [Generator, production and event timing](../Phase1_Dataset/code/generator.py#L141)
3. **Audit fraud and entity overlap.** Assert zero overlap of `batch_id` across splits, which also keeps the one-per-batch fraud records together. Check manufacturer overlap. Use production dates to report whether the same configured campaign windows appear across splits, and use `in_ring` with manufacturer ID to check repeated flagged manufacturers. The release provides no campaign ID or ring ID for verifying individual memberships. Consider a separate chronological manufacturer-disjoint evaluation if measuring performance on unseen manufacturers. [Configuration, ring and campaign windows](../Phase1_Dataset/code/config.yaml#L93) · [Generator, fraud record fields](../Phase1_Dataset/code/generator.py#L195)
4. **Build a small event-time baseline and test for shortcuts.** Start with documented current-event fields and verified scoring-time context. Compare models with and without raw seal and QR signals, GPS missingness, temperature-derived signals, and manufacturer or calendar context, using training and validation only. Keep undocumented release fields out until their timing and provenance are established. For any historical feature, test that adding or changing future rows leaves earlier feature values unchanged. Keep genuine anomalies and masked fraud because they are part of the prediction problem. [Generator, hard cases and evidence](../Phase1_Dataset/code/generator.py#L238)
5. **Fit all learned preprocessing on training data only.** Learn imputation, scaling, encodings, and feature selection from training rows. Apply the fitted steps to later splits. Use validation to compare models and choose a decision threshold. Preserve the original validation and test rows and class balance, and use the final test only after decisions are fixed. Save future outputs as Parquet under `processed/` and record the cutoffs, column decisions, and reproducibility settings. [Project instructions](../AGENTS.md)

This review used the four supplied source files and read-only release checks of Parquet metadata, keys, label consistency, and the documented cutoff. Neither source script was executed. No preprocessing was implemented or run, and no original dataset files were changed.

