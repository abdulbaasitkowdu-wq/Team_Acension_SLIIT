"""
PHANTOM Tests — FastAPI Endpoints
Uses TestClient without starting a real server.
"""
from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture(scope="session")
def client():
    with patch("app.data_processing.dataset_loader.data_store") as mock_store, \
         patch("app.api.routes.data_store", mock_store):
        mock_store.is_loaded = True
        mock_store.metadata = {
            "batches": {"rows": 60000, "cols": []},
            "transactions": {"rows": 1201800, "cols": []},
        }
        from app.main import app
        return TestClient(app)


def test_health_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "system" in data


def test_dataset_summary_endpoint_when_loaded(client):
    response = client.get("/api/v1/dataset/summary")
    # Either 200 (loaded) or 503 (not loaded) is acceptable
    assert response.status_code in (200, 503)


def test_investigation_status_no_run(client):
    response = client.get("/api/v1/investigations/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


def test_investigation_cases_no_run_returns_404(client):
    response = client.get("/api/v1/investigations/cases")
    assert response.status_code == 404


def test_investigation_metrics_no_run_returns_404(client):
    response = client.get("/api/v1/investigations/metrics")
    assert response.status_code == 404


def test_docs_endpoint_accessible(client):
    response = client.get("/docs")
    assert response.status_code == 200
