"""Backend configuration loaded from environment variables / `.env`.

All runtime configuration lives here. Values are read once at import via
`Settings()` and re-used through the `settings` singleton. Keeping this
centralized matches the demo's `src/data/siteIdentity.ts` pattern: one source
of truth that callers import rather than reaching into the environment.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Dev defaults that MUST NOT reach staging/production. Declared as module
# constants so both the ``Field`` defaults and the startup guard reference one
# source of truth.
_DEV_SECRET_KEY = "dev-secret-change-me"
_DEV_TOKEN_ENCRYPTION_KEY = "Ja8bRSsk6Jv4KsqqOXS-1x6Ht6jj5WIztmsXkzXTnS4="


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
        default=_DEV_SECRET_KEY,
        description="Symmetric secret used for JWT signing (Stage 3+).",
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="One of: development, staging, production.",
    )

    # --- JWT (architecture.md §5.3) ---
    JWT_ALGORITHM: str = Field(
        default="HS256",
        description="Signing algorithm for Buzz-issued JWTs.",
    )
    ACCESS_TOKEN_TTL_MINUTES: int = Field(
        default=60,
        description="Access-token lifetime in minutes (§5.3: 1 hour).",
    )
    REFRESH_TOKEN_TTL_DAYS: int = Field(
        default=7,
        description="Refresh-token lifetime in days (§5.3: 7 days).",
    )
    OAUTH_STATE_TTL_MINUTES: int = Field(
        default=10,
        description="Lifetime of the signed OAuth `state` CSRF token.",
    )

    # --- Refresh cookie (architecture.md §11.1) ---
    REFRESH_COOKIE_NAME: str = Field(default="buzz_refresh")
    REFRESH_COOKIE_SECURE: bool = Field(
        default=True,
        description="Set False for local HTTP dev so the cookie is sent.",
    )
    REFRESH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = Field(
        default="lax",
        description=(
            "Must be 'lax' (not 'strict'): the cookie is set on the OAuth "
            "callback after a cross-site redirect from Instagram; 'strict' "
            "would drop it."
        ),
    )
    REFRESH_COOKIE_PATH: str = Field(default="/api/auth")
    OAUTH_STATE_COOKIE_NAME: str = Field(
        default="buzz_oauth_state",
        description="Short-lived cookie binding the OAuth state to the browser.",
    )

    # --- Instagram OAuth (architecture.md §3.4) ---
    INSTAGRAM_CLIENT_ID: str = Field(default="")
    INSTAGRAM_CLIENT_SECRET: str = Field(default="")
    INSTAGRAM_REDIRECT_URI: str = Field(default="")
    INSTAGRAM_SCOPES: str = Field(
        default="instagram_business_basic,instagram_business_manage_insights",
    )
    INSTAGRAM_AUTHORIZE_URL: str = Field(
        default="https://www.instagram.com/oauth/authorize",
    )
    INSTAGRAM_TOKEN_URL: str = Field(
        default="https://api.instagram.com/oauth/access_token",
    )
    INSTAGRAM_GRAPH_BASE: str = Field(default="https://graph.instagram.com")

    # --- Token encryption at rest (architecture.md §10.5 / §11.1) ---
    TOKEN_ENCRYPTION_KEY: str = Field(
        default=_DEV_TOKEN_ENCRYPTION_KEY,
        description=(
            "urlsafe-base64 32-byte Fernet key for encrypting Instagram "
            "tokens at rest. MUST be overridden in staging/production; the "
            "default is a fixed dev key (a per-process random key could not "
            "decrypt previously persisted tokens)."
        ),
    )

    @model_validator(mode="after")
    def _forbid_default_secrets_outside_dev(self) -> "Settings":
        """Fail fast if a non-dev env still uses the committed dev secrets.

        A misconfigured staging/prod deploy would otherwise silently sign
        JWTs with a public secret and encrypt Instagram tokens with a public
        Fernet key — i.e. no security at all. Crash at startup instead.
        """

        if self.ENVIRONMENT == "development":
            return self
        offenders = []
        if self.SECRET_KEY == _DEV_SECRET_KEY:
            offenders.append("SECRET_KEY")
        if self.TOKEN_ENCRYPTION_KEY == _DEV_TOKEN_ENCRYPTION_KEY:
            offenders.append("TOKEN_ENCRYPTION_KEY")
        if offenders:
            raise ValueError(
                f"ENVIRONMENT={self.ENVIRONMENT!r} but these still use the "
                f"committed dev default(s): {', '.join(offenders)}. Set real "
                "secrets before deploying."
            )
        return self


settings = Settings()
