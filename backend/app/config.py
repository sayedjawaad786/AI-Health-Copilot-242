"""
config.py - Application settings loaded from environment / .env file.

Uses pydantic-settings so every value can be overridden via environment
variables or a .env file placed in the backend/ directory.
"""


import json
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration object for Health Copilot backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- Gemini --------------------------------------------------------------
    gemini_api_key: str = Field(
        default="",
        description="Google Gemini API key (required in production).",
    )
    gemini_model: str = Field(
        default="gemini-1.5-flash",
        description="Gemini model identifier. Override via GEMINI_MODEL env var.",
    )

    # -- Upload limits -------------------------------------------------------
    max_upload_mb: int = Field(
        default=10,
        description="Maximum file upload size in megabytes.",
        ge=1,
        le=100,
    )

    # -- CORS ----------------------------------------------------------------
    # Stored as a raw string to avoid pydantic-settings v2 attempting JSON
    # decoding on List[str] fields before any validator has a chance to run.
    # Accepts three formats via the ALLOWED_ORIGINS env var:
    #   1. JSON array  : ["https://a.vercel.app","https://b.vercel.app"]
    #   2. CSV string  : https://a.vercel.app,https://b.vercel.app
    #   3. Single URL  : https://a.vercel.app
    allowed_origins_raw: str = Field(
        default="http://localhost:5173",
        alias="allowed_origins",
        description=(
            "Allowed CORS origins. Supply as a JSON array, comma-separated "
            "string, or single URL via the ALLOWED_ORIGINS env var."
        ),
    )

    @property
    def allowed_origins(self) -> List[str]:
        """Parse allowed_origins_raw into a list of origin strings."""
        raw = self.allowed_origins_raw.strip()
        # Try JSON array first: ["https://...", "https://..."]
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(o).strip() for o in parsed if str(o).strip()]
            except json.JSONDecodeError:
                pass
        # Fall back to comma-separated or single value
        return [o.strip() for o in raw.split(",") if o.strip()]

    # -- Derived helpers -----------------------------------------------------
    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
