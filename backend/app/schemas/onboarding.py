"""Onboarding request/response schemas (architecture §3.4, §4)."""

from __future__ import annotations

from pydantic import field_validator

from app.schemas.common import CamelModel


class OrgOnboardingRequest(CamelModel):
    """Phase 2: submit org profile after Instagram OAuth."""

    org_name: str
    university: str
    edu_email: str
    instagram_handle: str
    tiktok_handle: str | None = None
    follower_count: int | None = None
    member_count: int | None = None
    city: str | None = None
    state: str | None = None
    contact_name: str | None = None
    delivery_address: str | None = None

    @field_validator("edu_email")
    @classmethod
    def _validate_edu(cls, v: str) -> str:
        if "@" not in v or len(v) > 320:
            raise ValueError("Invalid email address")
        if not v.strip().lower().endswith(".edu"):
            raise ValueError("Must be a .edu email address")
        return v.strip().lower()

    @field_validator("org_name", "university", "instagram_handle")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()


class VerifyEmailRequest(CamelModel):
    """Phase 3: verify .edu email with a one-time token."""

    token: str


class ResendVerificationRequest(CamelModel):
    """Re-send the verification email (rate-limited)."""

    pass


class BrandSetPasswordRequest(CamelModel):
    """Brand Phase 3: accept invite and set a password."""

    token: str
    password: str

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class BrandLoginRequest(CamelModel):
    """Brand email + password login."""

    email: str
    password: str
