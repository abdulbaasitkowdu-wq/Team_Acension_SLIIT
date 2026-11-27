"""
PHANTOM — Pytest Configuration
Adds the single_agent directory to sys.path and provides shared session fixtures
so the 1.2M-row dataset is loaded only once per test run.
"""
import sys
from pathlib import Path

import pytest

# Add single_agent/ to path so 'from app.xxx import yyy' works
sys.path.insert(0, str(Path(__file__).parent))


@pytest.fixture(scope="session")
def data_dir():
    base = Path(__file__).parent.parent / "Data"
    if not base.exists():
        pytest.skip(f"Data directory not found: {base}")
    return str(base)


@pytest.fixture(scope="session")
def loaded_store(data_dir):
    from app.data_processing.dataset_loader import DatasetStore
    store = DatasetStore()
    store.load(data_dir)
    return store
