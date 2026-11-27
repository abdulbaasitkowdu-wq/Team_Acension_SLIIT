# PHANTOM — Single-Agent Pharmaceutical Fraud Investigation System

> **P**harmaceutical **H**azard **A**nd **T**hreat **M**onitoring **O**peration **N**etwork

## Overview

PHANTOM is an evidence-driven, single-agent investigation system for pharmaceutical supply-chain fraud detection. It analyses preprocessed supply-chain datasets, validates relationships, reconstructs event timelines, detects anomalies, and generates structured investigation reports for human review.

> **Important**: This system does not make legal or regulatory determinations. It identifies suspicious patterns in data and flags cases for human expert review.

---

## Architecture

```
Dataset (Parquet) → Dataset Loader → Schema Inspector → Relational Validator
                                                       ↓
                              Anomaly Detector ← Timeline Builder
                                       ↓
                             Investigation Cases
                                       ↓
                          Evidence Retrieval Tools
                                       ↓
                         Single AI Investigation Agent (LangGraph)
                                       ↓
                        Pydantic-Validated Assessment
                                       ↓
                      Report Generator → JSON Output → FastAPI → React Dashboard
```

### Single-Agent Restriction
Only **one AI reasoning agent** is implemented. It performs a single bounded investigation pass per case. No multi-agent communication, debate loops, or independent LLM agents.

---

## Dataset Schema (Auto-Detected)

| Table | Rows | Primary Key | Ground Truth |
|-------|------|-------------|--------------|
| `batches` | 60,000 | `batch_id` | — |
| `entities` | 2,048 | `entity_id` | — |
| `fraud_events` | 60,000 | `batch_id` | `is_fraud_ground_truth`, `fraud_type` |
| `medicines` | 300 | `medicine_id` | — |
| `transactions` | 1,201,800 | composite | `is_fraud_ground_truth`, `fraud_type` |

**Supply-chain event sequence:**
`manufacturing → quality_test → packaging → warehouse_in → shipment → distributor_receipt → pharmacy_receipt → sale`

---

## Project Structure

```
single_agent/
├── data/                           # Symlink or copy your Data/ directory here
├── app/
│   ├── main.py                     # FastAPI entry point
│   ├── config/
│   │   ├── settings.py             # Environment-based settings
│   │   └── dataset_mapping.py      # Dataset column mapping (schema-aware)
│   ├── data_processing/
│   │   ├── dataset_loader.py       # Component A: Dataset loading & retrieval
│   │   ├── schema_inspector.py     # Schema validation
│   │   └── data_validator.py       # Data integrity validation
│   ├── validation/
│   │   ├── relational_validator.py # Component B: Relational integrity
│   │   └── timeline_validator.py   # Component C: Chronological timelines
│   ├── detection/
│   │   ├── anomaly_detector.py     # Component D: Anomaly detection
│   │   └── case_creator.py         # Case prioritization
│   ├── agent/
│   │   ├── investigator.py         # Single AI investigation agent
│   │   ├── prompts.py              # Evidence-grounded prompts
│   │   └── tools.py                # Deterministic evidence retrieval tools
│   ├── graph/
│   │   ├── state.py                # LangGraph workflow state
│   │   ├── nodes.py                # Workflow nodes (11 phases)
│   │   └── workflow.py             # Graph compilation and execution
│   ├── models/
│   │   ├── case.py                 # InvestigationCase
│   │   ├── evidence.py             # EvidenceItem
│   │   ├── timeline.py             # TimelineEvent, BatchTimeline
│   │   ├── assessment.py           # AnomalyAssessment
│   │   ├── metrics.py              # EvaluationMetrics
│   │   └── report.py               # InvestigationReport (final output)
│   ├── evaluation/
│   │   ├── metrics_calculator.py   # Precision, Recall, F1, FPR
│   │   └── performance_tracker.py  # Timing tracker
│   ├── reporting/
│   │   └── report_generator.py     # JSON report assembly
│   └── api/
│       └── routes.py               # FastAPI endpoints
├── tests/
│   ├── test_dataset_loader.py
│   ├── test_relational_validation.py
│   ├── test_timeline.py
│   ├── test_anomaly_detection.py
│   ├── test_agent.py
│   ├── test_report.py
│   ├── test_metrics.py
│   └── test_api.py
├── outputs/                        # Generated investigation reports (JSON)
├── .env.example                    # Environment configuration template
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Setup

### 1. Prerequisites

- Python 3.12+
- Anaconda or pip
- LLM API key (OpenAI, Anthropic, Google) **or** Ollama running locally

### 2. Install Dependencies

```bash
cd single_agent
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your LLM provider and API key:

```env
# Choose one provider:
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Or use Ollama (no API key):
# LLM_PROVIDER=ollama
# OLLAMA_MODEL=llama3.2
```

### 4. Place Your Dataset

Ensure your preprocessed parquet files are in `../Data/` relative to `single_agent/`:

```
Single Agent/
├── Data/
│   ├── batches.parquet
│   ├── entities.parquet
│   ├── fraud_events.parquet
│   ├── medicines.parquet
│   └── transactions.parquet
└── single_agent/
    └── ...
```

Or set `DATA_DIR` in `.env` to the absolute path of your data directory.

---

## Running the System

### Option A: FastAPI Server (for React dashboard)

```bash
cd single_agent
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then open: http://localhost:8000/docs

### Option B: Direct Python Execution

```python
# Run from single_agent/
from app.graph.workflow import run_investigation

state = run_investigation(max_cases=10)
print(f"Cases investigated: {len(state.agent_assessments)}")
print(f"Reports: {len(state.investigation_reports)}")
```

### Option C: Investigation CLI

```bash
cd single_agent
python -c "
from app.graph.workflow import run_investigation
state = run_investigation(max_cases=5)
for report in state.investigation_reports[:2]:
    print(report.report_id, report.investigation_status)
"
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | System health check |
| `GET` | `/api/v1/dataset/summary` | Dataset schema and row counts |
| `POST` | `/api/v1/investigations/run` | Start investigation workflow |
| `GET` | `/api/v1/investigations/status` | Current run status |
| `GET` | `/api/v1/investigations/cases` | All detected cases |
| `GET` | `/api/v1/investigations/cases/{case_id}` | Individual case + report |
| `GET` | `/api/v1/investigations/reports/{case_id}` | Full investigation report |
| `GET` | `/api/v1/investigations/metrics` | Evaluation metrics |

---

## Running Tests

```bash
cd single_agent
pytest tests/ -v --tb=short
```

Run specific test modules:
```bash
pytest tests/test_dataset_loader.py -v
pytest tests/test_anomaly_detection.py -v
pytest tests/test_metrics.py -v
```

---

## Anomaly Detectors Implemented

| Detector | Dataset Columns Used | Cases Produced |
|----------|---------------------|----------------|
| Duplicate serial numbers | `transactions.duplicate_serial` | `duplicate_identifier` |
| Fraud-detected transactions | `transactions.is_fraud_detected`, `fraud_type` | Various categories |
| Cold-chain temperature excursions | `transactions.rolling_excursion_rate` + `medicines.is_cold_chain` | `temperature_excursion` |
| Masked transactions | `transactions.is_masked` | `masked_transaction` |
| Inactive manufacturer license | `entities.license_status` + `batches.manufacturer_id` | `unauthorized_entity` |
| Authentication failures | `transactions.qr_verified`, `rfid_scanned`, `seal_intact` | `authentication_failure` |

---

## Evaluation Metrics

| Metric | Description |
|--------|-------------|
| Precision | TP / (TP + FP) — against `fraud_events.is_fraud_ground_truth` |
| Recall | TP / (TP + FN) |
| F1 Score | Harmonic mean of Precision and Recall |
| False Positive Rate | FP / (FP + TN) |
| Token Usage | Actual provider metadata (not estimated) |
| Investigation Time | Per-case and total |

---

## LLM Configuration

| Provider | Setting | Models |
|----------|---------|--------|
| OpenAI | `LLM_PROVIDER=openai` | `gpt-4o-mini`, `gpt-4o` |
| Anthropic | `LLM_PROVIDER=anthropic` | `claude-3-haiku-20240307` |
| Google | `LLM_PROVIDER=google` | `gemini-1.5-flash` |
| Ollama (local) | `LLM_PROVIDER=ollama` | `llama3.2`, `mistral` |

---

## Investigation Limitations

- Does **not** make legal or regulatory determinations
- Does **not** physically authenticate pharmaceutical products
- Does **not** evaluate chemical composition or medicine quality
- Assumes manufactured medicines are genuine products (MVP scope)
- Entity-level supply-chain tracking is limited (no `entity_id` in transaction records)
- Evidence is derived exclusively from the preprocessed dataset

---

## Output Reports

Investigation reports are saved as JSON to `outputs/`:

```json
{
  "report_id": "RPT-XXXXXXXX",
  "case_id": "CASE-YYYYYYYY",
  "investigation_status": "completed",
  "anomaly_category": "duplicate_identifier",
  "severity": "high",
  "case_details": { ... },
  "anomaly_assessment": {
    "anomaly_detected": true,
    "confidence": 0.82,
    "investigation_status": "anomaly_supported",
    "assessment_summary": "...",
    ...
  },
  "evaluation_metrics": { ... },
  "limitations": [ ... ]
}
```

---

## Comparison with Multi-Agent System

This single-agent baseline uses the **same dataset, evidence sources, and test cases** as the three-agent system (Investigator + Challenger + Adjudicator). Comparison metrics:

- Precision / Recall / F1 (against `fraud_events.is_fraud_ground_truth`)
- Token usage (prompt + completion tokens per case)
- Investigation time per case
- False positive rate

---

## License

For academic and research use only. Not for production pharmaceutical regulatory use.
