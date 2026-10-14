"""
config.py – Application settings loaded from environment / .env file.

Uses pydantic-settings so every value can be overridden via environment
variables or a .env file placed in the backend/ directory.
"""


from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration object for Health Copilot backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Gemini ──────────────────────────────────────────────────────────────
    gemini_api_key: str = Field(
        default="",
        description="Google Gemini API key (required in production).",
    )
    gemini_model: str = Field(
        default="gemini-1.5-flash",
        description="Gemini model identifier. Override via GEMINI_MODEL env var.",
    )

    # ── Upload limits ────────────────────────────────────────────────────────
    max_upload_mb: int = Field(
        default=10,
        description="Maximum file upload size in megabytes.",
        ge=1,
        le=100,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    allowed_origins: List[str] = Field(
        default=["http://localhost:5173"],
        description=(
            "List of allowed CORS origins. "
            "Supply as a JSON array or comma-separated string via ALLOWED_ORIGINS."
        ),
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _parse_origins(cls, v: object) -> List[str]:
        """Accept both a JSON list and a comma-separated string."""
        if isinstance(v, str):
            # Handle comma-separated: "http://localhost:5173,http://localhost:3000"
            return [o.strip() for o in v.split(",") if o.strip()]
        return v  # type: ignore[return-value]

    # ── Derived helpers ───────────────────────────────────────────────────────
    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
