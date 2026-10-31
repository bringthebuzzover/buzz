"""Onboarding request/response schemas (architecture §3.4, §4)."""

from __future__ import annotations

import uuid
from typing import Annotated

from pydantic import AfterValidator, ConfigDict
from pydantic.alias_generators import to_camel

from app.models.enums import OrgCategory
from app.schemas.common import CamelModel


def _edu_email(v: str) -> str:
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


def _required_text(v: str) -> str:
    if not v.strip():
        raise ValueError("Must not be empty")
    return v.strip()


def _blank_to_none(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


def _non_negative(v: int) -> int:
    if v < 0:
        raise ValueError("Must be zero or greater")
    return v


def _password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    return v


EduEmail = Annotated[str, AfterValidator(_edu_email)]
"""Trimmed, lower-cased address on a real ``.edu`` domain."""
RequiredText = Annotated[str, AfterValidator(_required_text)]
"""Trimmed; blank is rejected."""
OptionalText = Annotated[str | None, AfterValidator(_blank_to_none)]
"""Trimmed; blank becomes ``None``."""
NonNegativeInt = Annotated[int, AfterValidator(_non_negative)]
NewPassword = Annotated[str, AfterValidator(_password_strength)]
"""At least 8 characters."""


class _OrgProfileRequest(CamelModel):
    """Org profile fields shared by public apply and the legacy onboarding submit."""

    # extra="forbid" so a typo'd/unknown key is a 422, not silently dropped
    # (matches OrgProfileUpdate).
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    org_name: RequiredText
    university: RequiredText
    edu_email: EduEmail
    tiktok_handle: str | None = None
    member_count: NonNegativeInt
    category: OrgCategory
    city: OptionalText = None
    state: OptionalText = None
    contact_name: RequiredText
    shipping_line1: RequiredText
    shipping_line2: OptionalText = None
    shipping_city: RequiredText
    shipping_state: RequiredText
    shipping_postal_code: RequiredText
    shipping_place_id: OptionalText = None


class OrgApplyRequest(_OrgProfileRequest):
    """Public ``POST /api/orgs/apply`` — profile + claimed Instagram handle."""

    instagram_handle: RequiredText
    prefill_token: OptionalText = None
    drop_id: uuid.UUID | None = None
    pitch: OptionalText = None


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


class OrgOnboardingRequest(_OrgProfileRequest):
    """Phase 2: submit org profile after Instagram OAuth (legacy drain)."""

    # instagram_handle comes from the OAuth login username and follower_count
    # from Graph, so neither is client-supplied (extra=forbid rejects them).


class PublicResendVerificationRequest(CamelModel):
    """Public resend of .edu verify mail (no session; rate-limited)."""

    edu_email: EduEmail


class OrgConnectRedeemRequest(CamelModel):
    """Redeem approval connect-email token to mint a session."""

    token: str


class VerifyEmailRequest(CamelModel):
    """Phase 3: verify .edu email with a one-time token."""

    token: str


class ResendVerificationRequest(CamelModel):
    """Re-send the verification email (rate-limited)."""

    pass


class RotateEduEmailRequest(CamelModel):
    """Request a new .edu after first verify (pending-swap; PRODUCT §3.1)."""

    edu_email: EduEmail


class CancelPendingEduEmailRequest(CamelModel):
    """Clear a pending .edu rotate latch (auth required)."""

    pass


class BrandSetPasswordRequest(CamelModel):
    """Brand Phase 3: accept invite and set a password."""

    token: str
    password: NewPassword


class BrandLoginRequest(CamelModel):
    """Brand email + password login."""

    email: str
    password: str


class AdminLoginRequest(CamelModel):
    """Admin email + password login (admins have no Instagram identity)."""

    email: str
    password: str


class ForgotPasswordRequest(CamelModel):
    """Enumerate-safe password-reset request (brand only)."""

    email: str


class ResetPasswordRequest(CamelModel):
    """Consume a password-reset token and set a new password."""

    token: str
    password: NewPassword


class BrandChangePasswordRequest(CamelModel):
    """Signed-in brand password change. Wrong current password is not a 401."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    current_password: str
    new_password: NewPassword
