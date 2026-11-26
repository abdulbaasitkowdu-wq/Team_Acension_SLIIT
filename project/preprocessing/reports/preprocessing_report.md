# Preprocessing validation report

The [validation notebook](../notebooks/08_Preprocessing_Validation.ipynb) verified and saved 1,164,472 retained transactions across three splits. No model was trained. The notebook generates the local output manifest at `processed/final/manifest.json`.

## Decisions

- The prediction unit is a transaction with key `(batch_id, leg, event_type)`. The recorded `timestamp` is the offline scoring clock. The documented batch-level fraud decision is copied to transactions and saved separately as a binary target. [Prediction design](prediction_design.md)
- The frozen split keeps batches and matching timestamps together across the retained windows. It excludes 37,328 rows from 1,536 boundary-spanning batches. All later checks use the same assignments.
- Cleaning uses fixed schemas and categories, preserves expected source nulls and valid anomalies, and converts dates and clocks to native types. It removed zero source rows in this release. [Cleaning notebook](../notebooks/04_Data_Cleaning.ipynb)
- Validated many-to-one joins link transactions to batches and batches to medicine and manufacturer records. Only fixed catalogue storage information enters the features. The remaining lookup data support validation. [Integration report](data_integration.md)
- The 16 audited inputs cover current observations, fixed storage information, and strictly earlier events of the same batch. The current row and same-timestamp rows contribute only to later history. Identifiers and timestamps remain metadata. [Leakage audit](leakage_audit.md)
- Numerical values use training medians and standard scaling. Categorical values use training modes and one-hot encoding with unknowns ignored. The encoder is sparse internally. The combined release matrices use the smaller dense float32 representation. Training weights are saved separately. No split was resampled. [Fitting notebook](../notebooks/07_Final_Preprocessing.ipynb)

## Saved split results

| Split | Rows | Engineered inputs | Transformed columns | Genuine | Fraud | Fraud share | Observed timestamp range |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| train | 831,536 | 16 | 26 | 748,336 | 83,200 | 10.01% | `2024-01-01T05:25:46` to `2025-05-16T12:51:34` |
| validation | 161,976 | 16 | 26 | 144,800 | 17,176 | 10.60% | `2025-05-16T13:08:09` to `2025-09-02T13:39:35` |
| test | 170,960 | 16 | 26 | 153,712 | 17,248 | 10.09% | `2025-09-02T14:05:37` to `2025-12-30T22:38:31` |

Raw engineered history is missing only for the 58,464 first-event rows. All transformed splits have zero missing and zero infinite values. All feature, label and timestamp rows round-tripped exactly. The model-ready files carry only encoded features. Keyed engineered and target files share their row order. See the output manifest for file hashes.

## Verification and reproducibility

- Rebuilt the complete feature frame, independently recalculated all prior counts, and checked the detailed history statistics against direct time filtering on 195 rows.
- Found no duplicate composite keys or overlap between retained splits. Identifiers, outcomes, raw calendar values, and held-out simulator columns stayed outside the model matrix.
- A fresh fit on training features reproduced the complete saved preprocessor state. Applying it to validation and test did not change that state. An unseen event type encoded to zeros for its field.
- Training class weights are 0.555590 for genuine and 4.997212 for fraud.

### Automated tests

```text
..........                                                               [100%]
10 passed in 16.63s
```

The release is suitable for retrospective preprocessing validation. Event arrival and fraud confirmation times are unavailable. Manufacturers and products recur across splits, so later performance claims about unseen groups require separate evaluation. [Leakage audit](leakage_audit.md)
