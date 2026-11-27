"""
PHANTOM — Application Settings
Loaded from environment variables or .env file.
All sensitive values (API keys) must be in .env, never committed.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # -------------------------------------------------------------------------
    # LLM Provider
    # -------------------------------------------------------------------------
    llm_provider: Literal["openai", "anthropic", "google", "ollama"] = "openai"

    # OpenAI
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = "gpt-4o-mini"
    openai_max_tokens: int = 4096
    openai_temperature: float = 0.0

    # Anthropic
    anthropic_api_key: Optional[str] = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = "claude-3-haiku-20240307"

    # Google
    google_api_key: Optional[str] = Field(default=None, alias="GOOGLE_API_KEY")
    google_model: str = "gemini-1.5-flash"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # -------------------------------------------------------------------------
    # Data
    # -------------------------------------------------------------------------
    data_dir: str = Field(default="../Data", alias="DATA_DIR")

    # -------------------------------------------------------------------------
    # Investigation thresholds
    # -------------------------------------------------------------------------
    max_cases_per_run: int = 50
    temp_excursion_rate_threshold: float = 0.3
    duplicate_serial_flag: bool = True
    min_anomaly_severity: Literal["low", "medium", "high", "critical"] = "medium"

    # -------------------------------------------------------------------------
    # API
    # -------------------------------------------------------------------------
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = False

    # -------------------------------------------------------------------------
    # Output
    # -------------------------------------------------------------------------
    output_dir: str = "outputs"
    save_reports: bool = True
    report_format: str = "json"

    # -------------------------------------------------------------------------
    # Logging
    # -------------------------------------------------------------------------
    log_level: str = "INFO"

    @field_validator("data_dir", mode="before")
    @classmethod
    def resolve_data_dir(cls, v: str) -> str:
        """Resolve relative data_dir against the project root."""
        p = Path(v)
        if not p.is_absolute():
            # Resolve relative to the single_agent/ directory
            project_root = Path(__file__).parent.parent.parent
            p = (project_root / v).resolve()
        return str(p)

    def get_llm_kwargs(self) -> dict:
        """Return LLM constructor kwargs for the configured provider."""
        if self.llm_provider == "openai":
            return {
                "model": self.openai_model,
                "temperature": self.openai_temperature,
                "max_tokens": self.openai_max_tokens,
                "api_key": self.openai_api_key,
            }
        elif self.llm_provider == "anthropic":
            return {
                "model": self.anthropic_model,
                "temperature": 0.0,
                "api_key": self.anthropic_api_key,
            }
        elif self.llm_provider == "google":
            return {
                "model": self.google_model,
                "google_api_key": self.google_api_key,
            }
        elif self.llm_provider == "ollama":
            return {
                "model": self.ollama_model,
                "base_url": self.ollama_base_url,
            }
        return {}


# Singleton settings instance
settings = Settings()
