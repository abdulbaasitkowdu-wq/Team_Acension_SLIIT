# Pharmaceutical Supply Chain Fraud Detection

This project prepares the synthetic TRACE-X dataset for retrospective, transaction-level fraud detection. Each row represents a lifecycle event. The binary target records whether its batch was labelled fraudulent. The preprocessing pipeline has been validated through dataset export and automated tests. Model training is a separate phase.

## Set up on Windows

Run these commands from `project/preprocessing/` in the team checkout. Reuse the local environment if it already exists. Create `Phase1_Dataset/dataset/` locally and place the five Parquet tables from the original TRACE-X release there: `batches.parquet`, `entities.parquet`, `fraud_events.parquet`, `medicines.parquet`, and `transactions.parquet`. Git ignores this input directory and the generated files.

```powershell
if (-not (Test-Path .\.venv\Scripts\python.exe)) { py -3.14 -m venv .venv }
$projectPython = (Resolve-Path .\.venv\Scripts\python.exe).Path
& $projectPython -m pip install -r requirements.txt
& $projectPython -m jupyter lab
```

Notebook `08` records package versions in the local `processed/final/manifest.json`. Use the same Scikit-learn version when loading the saved pipeline. The dataset generator and example validator under `Phase1_Dataset/code/` are references for the reports. They use Polars, NetworkX, and Faker in addition to the preprocessing dependencies. The notebooks expect the original Parquet release, which has columns the supplied generator does not write.

## Execute the notebooks

Run notebooks `01` through `08` in numeric order with the project kernel. After notebook `01`, run the target preparation Python cell in `reports/prediction_design.md` from a Jupyter notebook. Notebook `02` consumes the resulting `processed/transaction_target.parquet`. The copies in this module have empty outputs. Clear outputs before saving a notebook for Git after running it locally.

To execute from PowerShell, close JupyterLab or use a second terminal. Set `$projectPython` as above, then run the following. The here-string executes the target preparation cell. Notebook execution writes its generated data and reports locally. The commands discard the executed notebook copies.

```powershell
& $projectPython -B -m nbconvert --to notebook --execute --stdout --ExecutePreprocessor.timeout=260 .\notebooks\01_Data_Understanding.ipynb | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Notebook 01 failed" }
@'
from pathlib import Path

design = Path("reports/prediction_design.md")
markdown = design.read_text(encoding="utf-8")
target_cell = markdown.split("```python\n", 1)[1].split("\n```", 1)[0]
exec(compile(target_cell, str(design), "exec"))
'@ | & $projectPython -B -
if ($LASTEXITCODE -ne 0) { throw "Target preparation failed" }

Get-ChildItem .\notebooks\0[2-8]_*.ipynb | Sort-Object Name | ForEach-Object {
    & $projectPython -B -m nbconvert --to notebook --execute --stdout --ExecutePreprocessor.timeout=260 $_.FullName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to execute $($_.Name)" }
}
& $projectPython -B -m pytest -q -p no:cacheprovider tests
```

Notebook `08` builds the final files and runs the same suite. The artifact tests expect those files to exist.

## Preprocessing methodology

1. Use `transactions.timestamp` as the offline prediction clock. Identify each event by `(batch_id, leg, event_type)` and keep the binary ground truth separately.
2. Freeze chronological training, validation, and test assignments. Keep batches intact. Record boundary-spanning batches as excluded and keep their timing and assignments in the manifest.
3. Clean the five tables with fixed schemas and documented categories. Preserve valid outliers and meaningful nulls. Validate many-to-one joins and limit feature lookups to verified static catalogue values.
4. Engineer history from strictly earlier events in the same batch. Keep identifiers, raw dates and fraud metadata out of modelling inputs.
5. Fit numerical median imputation, standard scaling, categorical mode imputation and one-hot encoding on training alone. Transform the other splits with the same fitted state. Save training-only class weights without resampling. Materialize the final data as Parquet.

See the [preprocessing report](reports/preprocessing_report.md) for verified dimensions, target counts, and test results. See the [leakage audit](reports/leakage_audit.md) for the retrospective label and data-arrival limitations.

## Outputs for later modelling

| Location | Contents |
| --- | --- |
| `processed/cleaned/` | The five cleaned release tables for archive and reconstruction. |
| `processed/final/{split}_engineered.parquet` | Keyed, chronologically ordered rows with the 16 audited inputs and expected first-event history gaps. |
| `processed/final/{split}_X.parquet` | The 26 finite, transformed model inputs. The file contains only features. |
| `processed/final/{split}_target.parquet` | The binary target with transaction keys, in the same row order as the corresponding feature files. |
| `processed/final/manifest.json` | Split counts, ordering, input and output feature names, versions, and file checksums. |
| `artifacts/preprocessor.joblib` | The fitted Scikit-learn transformer. |
| `artifacts/final_feature_names.json` and `artifacts/training_class_weights.json` | Exact output column order and class weights learned from training labels. |

Use `train`, `validation`, or `test` for `{split}`. Preserve row order when pairing a model-ready file with its target. Use the keys in the engineered and target files to check alignment. The final notebook checks that the saved files match the frozen split.
