"""
PHANTOM — FastAPI Application Entry Point
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="PHANTOM — Pharmaceutical Fraud Investigation System",
    description=(
        "Single-Agent pharmaceutical supply-chain fraud detection system. "
        "Provides structured investigation reports for human review. "
        "Does not make legal determinations."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Pre-load datasets on startup for fast API responses."""
    from app.data_processing.dataset_loader import data_store
    from app.config.settings import settings
    logger.info("PHANTOM API starting up...")
    logger.info(f"LLM Provider: {settings.llm_provider}")
    logger.info(f"Data directory: {settings.data_dir}")
    try:
        data_store.load()
        logger.info("Datasets pre-loaded successfully.")
    except Exception as e:
        logger.warning(f"Dataset pre-load failed (will retry on first request): {e}")


if __name__ == "__main__":
    import uvicorn
    from app.config.settings import settings
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
    )
