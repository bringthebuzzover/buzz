"""Backend configuration loaded from environment variables / `.env`.

All runtime configuration lives here. Values are read once at import via
`Settings()` and re-used through the `settings` singleton. Keeping this
centralized matches the demo's `src/data/siteIdentity.ts` pattern: one source
of truth that callers import rather than reaching into the environment.
"""

from __future__ import annotations

import base64
import hashlib
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Dev defaults that MUST NOT reach staging/production. Declared as module
# constants so both the ``Field`` defaults and the startup guard reference one
# source of truth.
#
# PyJWT HS256 wants ≥32-byte HMAC keys (RFC 7518 §3.2). Keep the recognizable
# prefix; always forbid the historical short literal even after lengthening.
_HISTORICAL_DEV_SECRET_KEY = "dev-secret-change-me"
_DEV_SECRET_KEY = "dev-secret-change-me-not-for-production!!"
_FORBIDDEN_DEV_SECRET_KEYS = frozenset({_HISTORICAL_DEV_SECRET_KEY, _DEV_SECRET_KEY})


def _derived_dev_fernet_key() -> str:
    """Stable local/CI Fernet key that is not a committed key string.

    GitGuardian matches Fernet-shaped literals in git. Deriving at runtime
    keeps encrypt/decrypt working in development without a Generic Encryption
    Key in the tree. Off-dev still requires a real env value.
    """

    digest = hashlib.sha256(b"buzz-dev-fernet-not-a-secret").digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


# SHA-256 of a historical committed Fernet dummy (removed from source). Still
# rejected off-dev if someone pastes that old value into Railway.
_FORBIDDEN_TOKEN_ENCRYPTION_KEY_SHA256 = frozenset(
    {
        "3897030c6bdc20dce7867c474ad8de8248740528b1484b3eaf7b98e6c5b8057a",
    }
)


def _token_encryption_key_sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _is_forbidden_token_encryption_key(value: str) -> bool:
    if not value or value == _derived_dev_fernet_key():
        return True
    return _token_encryption_key_sha256(value) in _FORBIDDEN_TOKEN_ENCRYPTION_KEY_SHA256


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
        description=(
            "SQLAlchemy async PostgreSQL URL. Accepts Railway-style "
            "`postgres://` / `postgresql://` and rewrites to "
            "`postgresql+asyncpg://` at load time."
        ),
    )
    SECRET_KEY: str = Field(
        default=_DEV_SECRET_KEY,
        description="Symmetric secret used for JWT signing (Stage 3+).",
    )
    ENVIRONMENT: Literal["development", "staging", "production"] = Field(
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

    # --- Admin impersonation ---
    IMPERSONATION_READONLY: bool = Field(
        default=True,
        description=(
            "When True (the default), impersonation tokens carry `imp_readonly` "
            "and the API rejects every mutating request made while an admin is "
            "viewing as another user. Set False to allow writes (local debugging)."
        ),
    )
    IMPERSONATION_TOKEN_TTL_MINUTES: int = Field(
        default=15,
        description=(
            "Lifetime of an impersonation access token. Deliberately shorter "
            "than ACCESS_TOKEN_TTL_MINUTES; no refresh token is issued, so the "
            "admin re-mints to continue."
        ),
    )

    # --- Refresh cookie (architecture.md §11.1) ---
    REFRESH_COOKIE_NAME: str = Field(default="buzz_refresh")
    REFRESH_COOKIE_SECURE: bool = Field(
        default=False,
        description=(
            "Dev-friendly default (False) so the cookie is sent over http://localhost. "
            "The startup validator REJECTS startup unless this is True when "
            "ENVIRONMENT != development, so prod can never ship insecure."
        ),
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

    # --- Business Discovery (apply-time handle lookup; META.md) ---
    FACEBOOK_GRAPH_BASE: str = Field(
        default="https://graph.facebook.com",
        description="Graph host for Business Discovery (Facebook Login path).",
    )
    INSTAGRAM_BUSINESS_DISCOVERY_TOKEN: str = Field(
        default="",
        description=(
            "Long-lived Facebook Login token for the Buzz service IG account. "
            "Empty → lookup soft-fails (PRODUCT §6.1.1)."
        ),
    )
    INSTAGRAM_BUSINESS_DISCOVERY_IG_USER_ID: str = Field(
        default="",
        description="Buzz-owned Instagram professional account id for Business Discovery.",
    )

    # --- Google Address Validation + Places (org ship-to) ---
    GOOGLE_ADDRESS_API_KEY: str = Field(
        default="",
        description=(
            "Server-side Google Cloud key with Places API (New) + Address "
            "Validation. Empty is allowed only in development (format fallback). "
            "Required off-dev."
        ),
    )

    # --- Onboarding + email (architecture.md §3.4, §4) ---
    FRONTEND_URL: str = Field(
        default="http://localhost:3000",
        description="Base URL of the React SPA for building email links.",
    )
    VERIFICATION_TOKEN_TTL_HOURS: int = Field(
        default=24,
        description="Email verification link lifetime in hours.",
    )
    EDU_EMAIL_UNVERIFIED_CLAIM_TTL_HOURS: int = Field(
        default=24,
        description=(
            "How long an unverified .edu claim blocks another signup. After "
            "this TTL, a new onboarding/change-email may take over the address."
        ),
    )
    BRAND_INVITE_TOKEN_TTL_DAYS: int = Field(
        default=7,
        description="Brand account setup link lifetime in days.",
    )
    ORG_CONNECT_TOKEN_TTL_DAYS: int = Field(
        default=7,
        description="Org Connect Instagram link lifetime in days (after Approve).",
    )
    PASSWORD_RESET_TOKEN_TTL_HOURS: int = Field(
        default=1,
        description="Password-reset link lifetime in hours.",
    )
    RESEND_API_KEY: str = Field(
        default="",
        description="Resend API key for transactional emails (empty = dev/console).",
    )
    BRAND_SELF_REGISTRATION_ENABLED: bool = Field(
        default=True,
        description=(
            "When True, the public POST /api/brands/apply route accepts brand "
            "self-registrations (-> pending_review). When False, the route is "
            "disabled (403) and brands are admin-provisioned only."
        ),
    )

    # --- Rate limiting (architecture §11.1, Stage 9) ---
    RATE_LIMIT_ENABLED: bool = Field(
        default=True,
        description=(
            "In-memory per-IP (and per-account for login) rate limiting on auth "
            "+ public endpoints. Per-process: assumes a single web replica "
            "(see DEPLOYMENT.md). Disabled in the test suite."
        ),
    )

    # --- Token encryption at rest (architecture.md §10.5 / §11.1) ---
    TOKEN_ENCRYPTION_KEY: str = Field(
        default="",
        description=(
            "urlsafe-base64 32-byte Fernet key for encrypting Instagram "
            "tokens at rest. Empty is allowed only in development (derived "
            "local key). MUST be a real key in staging/production."
        ),
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: object) -> object:
        """Rewrite Railway/libpq URLs to the asyncpg SQLAlchemy dialect.

        Railway injects ``postgres://…`` or ``postgresql://…``. SQLAlchemy
        async needs ``postgresql+asyncpg://…``. Already-normalized URLs and
        other dialects are left unchanged.
        """

        if not isinstance(value, str) or not value:
            return value
        if value.startswith("postgresql+asyncpg://"):
            return value
        if value.startswith("postgres://"):
            return "postgresql+asyncpg://" + value.removeprefix("postgres://")
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value.removeprefix("postgresql://")
        return value

    @model_validator(mode="after")
    def _forbid_default_secrets_outside_dev(self) -> "Settings":
        """Fail fast if a non-dev env still uses the committed dev secrets.

        A misconfigured staging/prod deploy would otherwise silently sign
        JWTs with a public secret and encrypt Instagram tokens with a public
        Fernet key — i.e. no security at all. Crash at startup instead.
        """

        if self.ENVIRONMENT == "development":
            if not self.TOKEN_ENCRYPTION_KEY:
                self.TOKEN_ENCRYPTION_KEY = _derived_dev_fernet_key()
            return self
        offenders = []
        if self.SECRET_KEY in _FORBIDDEN_DEV_SECRET_KEYS:
            offenders.append("SECRET_KEY")
        if _is_forbidden_token_encryption_key(self.TOKEN_ENCRYPTION_KEY):
            offenders.append("TOKEN_ENCRYPTION_KEY")
        if offenders:
            raise ValueError(
                f"ENVIRONMENT={self.ENVIRONMENT!r} but these still use the "
                f"committed dev default(s): {', '.join(offenders)}. Set real "
                "secrets before deploying."
            )

        # Refresh/OAuth cookies must be Secure off-dev (they ride HTTPS only),
        # and the SPA base URL must be a real remote host so email links don't
        # point at localhost. Fail fast rather than ship a broken session layer.
        misconfig = []
        if not self.REFRESH_COOKIE_SECURE:
            misconfig.append("REFRESH_COOKIE_SECURE must be True")
        host = urlparse(self.FRONTEND_URL).hostname or ""
        if not host or host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
            misconfig.append("FRONTEND_URL must be the real SPA URL (not localhost)")

        # Instagram OAuth is the org portal's only login path (§3.4); empty creds
        # would let the backend boot "healthy" and then fail every org login. The
        # startup crash surfaces the missing config at deploy time instead.
        for var in ("INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_REDIRECT_URI"):
            if not getattr(self, var):
                misconfig.append(f"{var} must be set (org login depends on it)")

        # Transactional email (verification + denial notices) silently no-ops
        # without a Resend key — email verification gates org portal access, so
        # a missing key strands every real signup. Fail fast off-dev.
        if not self.RESEND_API_KEY:
            misconfig.append("RESEND_API_KEY must be set (verification/denial email depends on it)")
        if not self.GOOGLE_ADDRESS_API_KEY:
            misconfig.append("GOOGLE_ADDRESS_API_KEY must be set (org shipping address verify)")

        if misconfig:
            raise ValueError(
                f"ENVIRONMENT={self.ENVIRONMENT!r} misconfigured: " + "; ".join(misconfig) + "."
            )
        return self


settings = Settings()
