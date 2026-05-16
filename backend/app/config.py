"""Backend configuration loaded from environment variables / `.env`.

All runtime configuration lives here. Values are read once at import via
`Settings()` and re-used through the `settings` singleton. Keeping this
centralized matches the demo's `src/data/siteIdentity.ts` pattern: one source
of truth that callers import rather than reaching into the environment.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Process-wide configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://localhost/buzz",
        description="SQLAlchemy async PostgreSQL URL.",
    )
    SECRET_KEY: str = Field(
        default="dev-secret-change-me",
        description="Symmetric secret used for JWT signing (Stage 3+).",
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="One of: development, staging, production.",
    )


settings = Settings()
