# TRACE-X Dataset

Synthetic pharmaceutical supply-chain dataset spanning Saudi Arabia
(SFDA) and Pakistan (DRAP).

## Files (`dataset/`)

| File | Rows | Contents |
|---|---|---|
| `entities.parquet` / `.csv` | 2,048 | supply-chain participants |
| `medicines.parquet` | 300 | drug catalogue with storage requirements |
| `batches.parquet` | 60,000 | one row per manufactured batch |
| `fraud_events.parquet` | 60,000 | hidden ground-truth fraud label per batch |
| `transactions.parquet` / `.csv` | 1,201,800 | one row per lifecycle event per shipment leg |

## Entities (2,048 total)

10 types per country:

| Type | KSA | PK |
|---|---|---|
| manufacturer | 8 | 15 |
| supplier | 20 | 40 |
| quality_lab | 8 | 15 |
| packaging_center | 8 | 15 |
| warehouse | 12 | 25 |
| logistics | 10 | 20 |
| distributor | 40 | 80 |
| pharmacy | 500 | 1000 |
| hospital | 80 | 150 |
| regulator | 1 | 1 |

Fields: `entity_id`, `entity_type`, `country`, `regulator` (SFDA/DRAP),
`enforcement_level` (strict/soft), `city`, `latitude`, `longitude`,
`license_number`, `license_status` (active/expired/suspended),
`license_expiry`, `gmp_compliant`, `pics_compliant`,
`sfda_gmp_status`, `audit_score` (0-100), `years_of_operation`,
`is_importer`.

## Transactions (1,201,800 rows, 27 columns)

One row per lifecycle event (`manufacturing`, `quality_test`,
`packaging`, `warehouse_in`, `shipment`, `distributor_receipt`,
`pharmacy_receipt`, `sale`) per shipment leg per batch:

- **Identifiers / linkage**: `batch_id`, `country`, `event_type`, `leg`,
  `timestamp`, `sensor_id`, `previous_hash`, `current_hash`,
  `batch_tx_index`
- **Environmental / sensor evidence**: `temperature`, `humidity`,
  `gps_lat`, `gps_lng`, `weight`, `battery_level`, `door_open`
- **Verification signals**: `qr_verified`, `rfid_scanned`, `seal_intact`
- **Labels**: `is_fraud_ground_truth`, `fraud_type`, `is_masked`,
  `is_suspicious_genuine`, `is_fraud_detected`
- **Derived**: `rolling_excursion_rate`

## Fraud (60,000 batches, ~10% base rate)

| Type | Share |
|---|---|
| counterfeit | 30% |
| diversion | 15% |
| fake_qr | 15% |
| tampering | 10% |
| temperature | 10% |
| unauthorized_manufacturer | 8% |
| duplicate_batch | 5% |
| theft | 4% |
| relabel | 3% |

Hard cases: ~12% of genuine transactions are "suspicious genuine"
(look fraud-like but aren't); ~2% of fraud has its evidence masked
(hidden from observable features); GPS dropout is ~1% for genuine vs.
~25% for tampered shipments.

## Cold chain

Storage ranges are medicine-type-specific: vaccines/insulin/biologics
2-8°C (cold-chain); tablets 15-25°C; syrups 10-25°C. Cold-chain
shipments have an 18% natural excursion rate, ~41% of which are
significant (≥4°C over), ~50% of flagged excursions are false alarms.

## Split

Entity-disjoint and temporal: train ≤ 2025-08-31, test from
2025-09-01. Date range: 2024-01-01 to 2026-06-30.

## Known, disclosed data-quality issues

- **Cross-border edges**: 0.25% of supply-chain edges are cross-border
  versus a 10-15% target (a confirmed generator bug); no batch shows
  genuine multi-country transit in its transaction history.
- **Masked-fraud rate**: 2.05% when correctly normalized against the
  fraud population (matches the 2% target); an earlier analysis
  mis-reported this as 0.21% due to a denominator error.
