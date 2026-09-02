"""Onboarding request/response schemas (architecture §3.4, §4)."""

from __future__ import annotations

from pydantic import ConfigDict, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import OrgCategory
from app.schemas.common import CamelModel


class OrgApplyRequest(CamelModel):
    """Public ``POST /api/orgs/apply`` — profile + claimed Instagram handle."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    org_name: str
    university: str
    edu_email: str
    instagram_handle: str
    handle_confirmed: bool = False
    tiktok_handle: str | None = None
    member_count: int
    category: OrgCategory
    city: str | None = None
    state: str | None = None
    contact_name: str
    shipping_line1: str
    shipping_line2: str | None = None
    shipping_city: str
    shipping_state: str
    shipping_postal_code: str
    shipping_place_id: str | None = None
    prefill_token: str | None = None

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

    @field_validator(
        "org_name",
        "university",
        "contact_name",
        "shipping_line1",
        "shipping_city",
        "shipping_state",
        "shipping_postal_code",
    )
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()

    @field_validator("city", "state")
    @classmethod
    def _optional_campus(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("shipping_line2", "shipping_place_id", "prefill_token")
    @classmethod
    def _optional_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("instagram_handle")
    @classmethod
    def _handle_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()

    @field_validator("member_count")
    @classmethod
    def _non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Must be zero or greater")
        return v


class OrgApplyPrefillResponse(CamelModel):
    """Public GET draft for ``/org/apply?prefill=`` (no extras / invite email)."""

    org_name: str | None = None
    university: str | None = None
    edu_email: str | None = None
    instagram_handle: str | None = None
    member_count: int | None = None
    category: str | None = None
    contact_name: str | None = None
    shipping_line1: str | None = None
    shipping_line2: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_postal_code: str | None = None
    shipping_raw: str | None = None


class OrgOnboardingRequest(CamelModel):
    """Phase 2: submit org profile after Instagram OAuth (legacy drain)."""

    # extra="forbid" so a typo'd/unknown key is a 422, not silently dropped
    # (matches OrgProfileUpdate).
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    org_name: str
    university: str
    edu_email: str
    # instagram_handle is derived from the OAuth login username — not client-supplied.
    tiktok_handle: str | None = None
    # follower_count is Graph-owned — omitted from create (extra=forbid rejects client write).
    member_count: int
    category: OrgCategory
    city: str | None = None
    state: str | None = None
    contact_name: str
    shipping_line1: str
    shipping_line2: str | None = None
    shipping_city: str
    shipping_state: str
    shipping_postal_code: str
    shipping_place_id: str | None = None

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

    @field_validator(
        "org_name",
        "university",
        "contact_name",
        "shipping_line1",
        "shipping_city",
        "shipping_state",
        "shipping_postal_code",
    )
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()

    @field_validator("city", "state")
    @classmethod
    def _optional_campus(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("shipping_line2", "shipping_place_id")
    @classmethod
    def _optional_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("member_count")
    @classmethod
    def _non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Must be zero or greater")
        return v


class PublicResendVerificationRequest(CamelModel):
    """Public resend of .edu verify mail (no session; rate-limited)."""

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


class OrgConnectRedeemRequest(CamelModel):
    """Redeem approval connect-email token to mint a session."""

    token: str


class InstagramLookupResponse(CamelModel):
    """Business Discovery lookup result for the apply confirm card."""

    available: bool
    username: str | None = None
    name: str | None = None
    profile_picture_url: str | None = None
    biography: str | None = None
    followers_count: int | None = None
    reason: str | None = None  # not_found | not_professional | unavailable | throttled


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


class RotateEduEmailRequest(CamelModel):
    """Request a new .edu after first verify (pending-swap; PRODUCT §3.1)."""

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


class CancelPendingEduEmailRequest(CamelModel):
    """Clear a pending .edu rotate latch (auth required)."""

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
