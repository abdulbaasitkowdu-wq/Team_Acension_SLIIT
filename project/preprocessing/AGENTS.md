# Project: Pharmaceutical Supply Chain Fraud Detection

## Objective
Build a reproducible machine learning preprocessing
pipeline for transaction-level fraud detection.

Confirm the prediction target using dataset documentation.

## General Rules
- Explain all steps in simple English.
- Use Python and Jupyter Notebook.
- Prefer Parquet files.
- Never modify the original dataset.
- Never invent column names or dataset statistics.
- Inspect the actual schema before implementation.
- Implement one preprocessing phase at a time.

## Data Leakage Prevention
- Define the exact prediction time.
- Use only information available at prediction time.
- Use chronological train/validation/test splitting.
- Learn preprocessing parameters from training data only.
- Never use future transactions for historical features.
- Keep target labels separate from input features.
- Check fraud event and campaign overlap across splits.
- Investigate synthetic generation artifacts.
- Do not use test data for feature selection.
- Do not resample validation or test datasets.
- Do not remove anomalies without justification.

## Code Quality
- Use meaningful variable names.
- Add beginner-friendly comments.
- Use reproducible random seeds where relevant.
- Validate table joins and row counts.
- Include assertions and leakage tests.
- Document preprocessing decisions.

## Workflow
- Explain the plan before implementing.
- Complete only the requested phase.
- Report actual execution results.
- Stop for review before starting the next phase.