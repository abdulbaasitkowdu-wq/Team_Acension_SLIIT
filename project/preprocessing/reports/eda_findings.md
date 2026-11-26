# Training data exploration

The [executed notebook](../notebooks/03_Exploratory_Data_Analysis.ipynb) analysed 831,536 transactions from 41,560 training batches using the fixed split. It used the seven approved current-event fields, the transaction clock for time summaries, and the separate retrospective target. Scoring-time versions of conditional lookup fields have yet to be established. [Prediction design](prediction_design.md)

## Target and missing values

There are 748,336 genuine and 83,200 fraudulent transactions (10.01% fraud). At batch level, 4,183 of 41,560 are labelled fraud (10.06%). The eligible fields, clock and target contain 0 missing values in total.

## Numerical and categorical distributions

| Field | min | 25% | 50% | 75% | max | mean | std |
| --- | --- | --- | --- | --- | --- | --- | --- |
| humidity | 30.0 | 40.0 | 50.0 | 60.0 | 70.0 | 49.995 | 11.546 |
| weight | 8.604 | 9.798 | 10.0 | 10.202 | 11.407 | 10.0 | 0.3 |
| battery_level | 20.0 | 39.0 | 60.0 | 80.0 | 99.0 | 59.506 | 23.111 |

| Field | Most common level | Largest level count | Smallest level count |
| --- | --- | --- | --- |
| event_type | distributor_receipt | 103942 | 103942 |
| leg | 0 | 332480 | 83208 |
| rfid_scanned | True | 789813 | 41723 |
| door_open | False | 790049 | 41487 |

Humidity and battery readings spread fairly evenly across their observed ranges. Weight readings cluster around 10.0.

## Changes over time

Training events run from 2024-01-01 05:25:46 through 2025-05-16 12:51:34. Across interior weeks, weekly volume ranged from 8,465 to 12,680 and the fraud share ranged from 7.56% to 14.50%. The first and last weekly bins were omitted from these ranges because the training window can cut them short.

## Relationships with fraud

- `event_type` has 8 observed levels. All have the same fraud share of 10.01%.
- `leg` has 4 observed levels. Fraud shares range from 9.77% (3, 83,208 rows) to 10.06% (0, 332,480 rows).
- `rfid_scanned` has 2 observed levels. Fraud shares range from 9.99% (True, 789,813 rows) to 10.21% (False, 41,723 rows).
- `door_open` has 2 observed levels. Fraud shares range from 9.90% (True, 41,487 rows) to 10.01% (False, 790,049 rows).
- `humidity` has 10 bands with at least 100 rows. Their fraud shares range from 9.83% to 10.18%.
- `weight` has 8 bands with at least 100 rows. Their fraud shares range from 9.72% to 10.31%.
- `battery_level` has 10 bands with at least 100 rows. Their fraud shares range from 9.87% to 10.14%.

The largest absolute Spearman correlation with the target among numeric, ordered and Boolean inputs was -0.0025 for `leg`. The notebook shows the full correlation matrix. These summaries are descriptive. Rows from the same batch share a label, and differences between categories or bands may reflect which batches contributed rows.

## Outliers

| Field | lower fence | upper fence | below | above | flagged_pct |
| --- | --- | --- | --- | --- | --- |
| humidity | 10.0 | 90.0 | 0 | 0 | 0.0 |
| weight | 9.192 | 10.808 | 3001 | 2813 | 0.6992 |
| battery_level | -22.5 | 141.5 | 0 | 0 | 0.0 |

The fences are descriptive IQR cutoffs. Confirm the reading units and legitimate operating ranges before applying any sensor rule.

## Feature leakage review

The screen found 0 single-label categories or bands among 44 groups with at least 100 training rows. This checks simple shortcuts only. Simulator documentation independently supports holding out seal, QR, GPS dropout, some temperature signals, campaign calendar proxies, target metadata, and undocumented history fields. Keep batch and transaction identifiers for joining and grouping. [Dataset understanding](dataset_understanding.md#9-synthetic-shortcuts-that-can-reveal-the-target)

## Cleaning and feature engineering decisions for the next phase

- Validate the observed categories and sensor types at input. The training inspection provides no reason to fill values now. Define how a later pipeline handles missing or unseen values when they occur.
- Preserve flagged readings unless supporting evidence shows a recording error. Keep rare categories and retain every transaction in the fixed training split.
- Use the recorded event type, leg and scan or door flags only if available when scoring. Consider encoding event type as a nominal category and keeping leg as an ordered value. Compare those options on validation once preprocessing begins.
- Keep the timestamp for ordering. Any future batch-history feature should use events strictly earlier than the score, with a verified rule for timestamp ties. Keep raw calendar signals outside the initial candidate set.
- Keep class counts visible and use fraud-sensitive evaluation metrics later. Fit any encoding, scaling or default values on training only. No transformation was fitted and no data were resampled here.

All graphs and relationship checks use training rows. The original datasets and saved split files were read-only.
