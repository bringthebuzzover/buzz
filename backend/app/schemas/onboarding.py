"""Onboarding request/response schemas (architecture §3.4, §4)."""

from __future__ import annotations

from pydantic import ConfigDict, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import OrgCategory
from app.schemas.common import CamelModel


class OrgOnboardingRequest(CamelModel):
    """Phase 2: submit org profile after Instagram OAuth."""

    # extra="forbid" so a typo'd/unknown key is a 422, not silently dropped
    # (matches OrgProfileUpdate).
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    org_name: str
    university: str
    edu_email: str
    # instagram_handle is derived from the OAuth login username — not client-supplied.
    tiktok_handle: str | None = None
    follower_count: int | None = None
    member_count: int | None = None
    category: OrgCategory | None = None
    city: str | None = None
    state: str | None = None
    contact_name: str | None = None
    delivery_address: str | None = None

    @field_validator("edu_email")
    @classmethod
    def _validate_edu(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 320 or v.count("@") != 1:
            raise ValueError("Invalid email address")
        local, _, domain = v.partition("@")
        # Validate the *domain* ends in ".edu" (not the whole string) and has a
        # real label before it — so "x@uni.edu" passes but "a@.edu" or
        # "a@b@c.edu" (caught by the single-@ check above) do not.
        if not local or not domain.endswith(".edu") or len(domain) <= len(".edu"):
            raise ValueError("Must be a valid .edu email address")
        return v

    @field_validator("org_name", "university")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()

    @field_validator("follower_count", "member_count")
    @classmethod
    def _non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("Must be zero or greater")
        return v


class VerifyEmailRequest(CamelModel):
    """Phase 3: verify .edu email with a one-time token."""

    token: str


class ResendVerificationRequest(CamelModel):
    """Re-send the verification email (rate-limited)."""

    pass


class ChangeEduEmailRequest(CamelModel):
    """Correct a typo'd .edu while still awaiting verification."""

    edu_email: str

    @field_validator("edu_email")
    @classmethod
    def _validate_edu(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 320 or v.count("@") != 1:
            raise ValueError("Invalid email address")
        local, _, domain = v.partition("@")
        if not local or not domain.endswith(".edu") or len(domain) <= len(".edu"):
            raise ValueError("Must be a valid .edu email address")
        return v


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


class AdminLoginRequest(CamelModel):
    """Admin email + password login (admins have no Instagram identity)."""

    email: str
    password: str


class ForgotPasswordRequest(CamelModel):
    """Enumerate-safe password-reset request (brand or admin)."""

    email: str


class ResetPasswordRequest(CamelModel):
    """Consume a password-reset token and set a new password."""

    token: str
    password: str

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
