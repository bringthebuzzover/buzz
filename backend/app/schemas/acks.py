"""Small typed success payloads for mutation/ack endpoints.

Replaces ad-hoc ``camelize(dict)`` / ``{"ok": True}`` returns so OpenAPI can
describe ``data`` via ``DataResponse[T]``. Wire stays camelCase through
``CamelModel``.
"""

from __future__ import annotations

import uuid

from app.schemas.common import CamelModel


class InstagramBindStartResponse(CamelModel):
    authorize_url: str


class OkResponse(CamelModel):
    """Generic success ack (logout, notify, unlink, dismiss, password flows)."""

    ok: bool = True


class HealthStatusResponse(CamelModel):
    status: str
    version: str


class PublicConfigResponse(CamelModel):
    brand_self_registration_enabled: bool


class InstagramDeauthorizeResponse(CamelModel):
    """Meta deauthorize webhook ack. ``reason`` set on acknowledged no-ops."""

    ok: bool = True
    revoked: bool
    reason: str | None = None


class VerifyEmailResponse(CamelModel):
    """Onboarding verify may also mint a session (``access_token`` + ``user``)."""

    status: str
    access_token: str | None = None
    token_type: str | None = None
    user: dict[str, object] | None = None


class ResendVerificationResponse(CamelModel):
    email_sent_to: str


class ChangeEduEmailResponse(CamelModel):
    email_sent_to: str
    status: str


class RotateEduEmailResponse(CamelModel):
    email_sent_to: str
    pending_edu_email: str
    status: str


class CancelPendingEduEmailResponse(CamelModel):
    ok: bool = True
    status: str


class OrgOnboardingResponse(CamelModel):
    org_id: uuid.UUID
    status: str
    email_sent_to: str
    email_sent: bool


class BrandApplyResponse(CamelModel):
    brand_id: uuid.UUID
    status: str


class FinalizeApplicantsResponse(CamelModel):
    finalized_count: int
    accepted_count: int
    denied_count: int


class ClearInstagramTokenResponse(CamelModel):
    user_id: uuid.UUID
    instagram_token_cleared: bool


class AdminOrgEraseRequest(CamelModel):
    """Typed confirm payload — Instagram handle only (PRODUCT §3.1.2)."""

    confirm: str


class AdminOrgEraseResponse(CamelModel):
    user_id: uuid.UUID
    status: str
    email_sent: bool
    email_to_domain: str | None = None


class AdminOrgStatusResponse(CamelModel):
    org_id: uuid.UUID
    status: str
    email_sent: bool | None = None


class AdminBrandStatusResponse(CamelModel):
    brand_id: uuid.UUID
    status: str


class AdminBrandInviteResponse(CamelModel):
    """Approve / create-with-approve / resend-invite (may include email_sent)."""

    brand_id: uuid.UUID
    status: str
    email_sent: bool | None = None


class TrackerAdvanceResponse(CamelModel):
    drop_id: uuid.UUID
    stage: str


class DropTrackingResponse(CamelModel):
    drop_id: uuid.UUID
    tracking_number: str | None


class DropReopenResponse(CamelModel):
    drop_id: uuid.UUID
    manual_reopen: bool
