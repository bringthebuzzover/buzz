"""Admin endpoint schemas (architecture.md §5.1, §8.5).

Read schemas here mirror :mod:`app.services.admin_read`. Datetimes serialize to
epoch-ms like the rest of the API so the React hooks consume them without
remapping.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from pydantic import (
    BeforeValidator,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
)
from pydantic.alias_generators import to_camel

from app.schemas.auth import UserResponse
from app.schemas.common import CamelModel, to_epoch_ms, to_epoch_ms_required


def _epoch_ms_to_aware(value: Any) -> Any:
    """Convert wire epoch-ms int → aware UTC datetime; pass None through."""
    if value is None:
        return None
    if isinstance(value, bool) or isinstance(value, float):
        raise ValueError("must be an epoch-ms integer")
    if isinstance(value, datetime):
        return value
    if not isinstance(value, int):
        raise ValueError("must be an epoch-ms integer")
    return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)


class AdminPendingOrgItem(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    org_name: str
    university: str
    instagram_handle: str | None
    follower_count: int | None
    member_count: int | None
    status: str
    created_at: datetime

    @field_serializer("created_at")
    def _created_at_epoch(self, value: datetime) -> int:
        return int(value.timestamp() * 1000)


class AdminPendingBrandItem(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    brand_name: str
    company_email: str
    intent_message: str | None
    instagram_handle: str | None
    status: str
    created_at: datetime

    @field_serializer("created_at")
    def _created_at_epoch(self, value: datetime) -> int:
        return int(value.timestamp() * 1000)


class TrackerAdvanceRequest(CamelModel):
    stage: str
    tracking_number: str | None = None
    note: str | None = None


class TrackingRepairRequest(CamelModel):
    tracking_number: str


class AdminDropConfigPatch(CamelModel):
    """Admin logistics patch for a drop (omit = leave alone; explicit null = clear).

    Window fields accept epoch-ms integers on the wire (same as GET detail).
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    capacity_total: int | None = Field(default=None, ge=1)
    apply_open_at: Annotated[datetime | None, BeforeValidator(_epoch_ms_to_aware)] = None
    apply_close_at: Annotated[datetime | None, BeforeValidator(_epoch_ms_to_aware)] = None
    total_product_units: int | None = Field(default=None, ge=1)
    campaign_hashtag: str | None = None

    @field_validator("capacity_total", "apply_open_at", "apply_close_at")
    @classmethod
    def _required_not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("must not be null")
        return value

    @field_validator("apply_open_at", "apply_close_at")
    @classmethod
    def _reject_naive(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("must be timezone-aware")
        return value


class AdminCreateBrandRequest(CamelModel):
    """Admin-provisioned brand (works when public self-reg is off)."""

    brand_name: str
    company_email: str
    instagram_handle: str | None = None
    intent_message: str | None = None
    approve_now: bool = False

    @field_validator("company_email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1] or len(v) > 320:
            raise ValueError("Invalid email address")
        return v


class AdminUserItem(CamelModel):
    """A row in the ``/api/admin/users`` impersonation picker."""

    id: uuid.UUID
    portal_role: str
    status: str
    display_name: str | None
    email: str | None
    instagram_handle: str | None
    impersonatable: bool
    created_at: datetime

    @field_serializer("created_at")
    def _created_at_epoch(self, value: datetime) -> int:
        return int(value.timestamp() * 1000)


class ImpersonateResponse(CamelModel):
    """Result of ``POST /api/admin/impersonate/{user_id}``.

    Access token only — no refresh cookie is set, so the admin's own session
    survives and "Exit impersonation" is a pure client-side drop.
    """

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    readonly: bool


# ── Overview ────────────────────────────────────────────────────────────────


class AdminQueueItem(CamelModel):
    """One action-required queue. ``oldest_at`` is what makes a count
    actionable — three items sitting nine days is not three from this morning."""

    key: str
    count: int
    oldest_at: datetime | None

    @field_serializer("oldest_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminWarningItem(CamelModel):
    key: str
    count: int


class AdminOverviewResponse(CamelModel):
    generated_at: datetime
    queues: list[AdminQueueItem]
    warnings: list[AdminWarningItem]

    @field_serializer("generated_at")
    def _epoch(self, value: datetime) -> int | None:
        return to_epoch_ms(value)


# ── Health ──────────────────────────────────────────────────────────────────


class AdminSignal(CamelModel):
    """One health signal. ``ok`` means "nothing to act on", which for most
    signals is a zero count but not for the informational token buckets."""

    key: str
    count: int
    ok: bool
    detail: str | None = None


class AdminHealthResponse(CamelModel):
    generated_at: datetime
    pipeline: list[AdminSignal]
    instagram_tokens: list[AdminSignal]
    integrity: list[AdminSignal]
    silent: list[AdminSignal]

    @field_serializer("generated_at")
    def _epoch(self, value: datetime) -> int | None:
        return to_epoch_ms(value)


# ── Accounts ────────────────────────────────────────────────────────────────


class AdminOrgItem(CamelModel):
    """A row in ``GET /api/admin/orgs``.

    ``id`` (the ``organizations`` row) is nullable: ``pending_org_profile``
    users have not created a profile yet.
    """

    id: uuid.UUID | None
    user_id: uuid.UUID
    org_name: str | None
    university: str | None
    instagram_handle: str | None
    instagram_handle_confirmed: bool = False
    follower_count: int | None
    member_count: int | None
    category: str | None
    status: str
    edu_email: str | None
    email_verified_at: datetime | None
    approved_at: datetime | None
    last_login_at: datetime | None
    instagram_token_expires_at: datetime | None
    impersonatable: bool
    created_at: datetime

    @field_serializer(
        "email_verified_at",
        "approved_at",
        "last_login_at",
        "instagram_token_expires_at",
        "created_at",
    )
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminBrandItem(CamelModel):
    """A row in ``GET /api/admin/brands``.

    ``status`` (brand) and ``user_status`` disagree on purpose — see
    :func:`app.services.admin.list_brands`.
    """

    id: uuid.UUID
    user_id: uuid.UUID
    brand_name: str
    company_email: str
    intent_message: str | None
    instagram_handle: str | None
    status: str
    user_status: str
    password_set: bool
    approved_at: datetime | None
    last_login_at: datetime | None
    impersonatable: bool
    created_at: datetime

    @field_serializer("approved_at", "last_login_at", "created_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminApplicationTally(CamelModel):
    applied: int
    accepted: int
    denied: int


class AdminVerificationState(CamelModel):
    live_token_count: int
    latest_expires_at: datetime | None
    latest_used_at: datetime | None

    @field_serializer("latest_expires_at", "latest_used_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminOrgApproveRequest(CamelModel):
    """Honor-system confirm that the Instagram Tester invite was sent."""

    tester_invite_confirmed: bool = False


class AdminOrgDetail(CamelModel):
    user_id: uuid.UUID
    org_id: uuid.UUID | None
    status: str
    org_name: str | None
    university: str | None
    category: str | None
    instagram_handle: str | None
    instagram_handle_confirmed: bool = False
    instagram_username: str | None
    tiktok_handle: str | None
    follower_count: int | None
    member_count: int | None
    city: str | None
    state: str | None
    contact_name: str | None
    delivery_address: str | None
    edu_email: str | None
    email_verified_at: datetime | None
    approved_at: datetime | None
    created_at: datetime
    last_login_at: datetime | None
    instagram_token_expires_at: datetime | None
    instagram_token_refreshed_at: datetime | None
    impersonatable: bool
    applications: AdminApplicationTally
    post_count: int
    linked_post_count: int
    verification: AdminVerificationState

    @field_serializer(
        "email_verified_at",
        "approved_at",
        "created_at",
        "last_login_at",
        "instagram_token_expires_at",
        "instagram_token_refreshed_at",
    )
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminInviteState(CamelModel):
    """Latest brand invite token. ``used_at`` is ambiguous between redeemed and
    superseded, so read it alongside ``password_set``."""

    issued_at: datetime | None
    expires_at: datetime | None
    used_at: datetime | None

    @field_serializer("issued_at", "expires_at", "used_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminDropItem(CamelModel):
    id: uuid.UUID
    brand_id: uuid.UUID
    brand_name: str
    brand_status: str
    title: str
    stage: str
    capacity_total: int
    total_product_units: int | None
    applied_count: int
    accepted_count: int
    apply_open_at: datetime
    apply_close_at: datetime
    manual_reopen: bool
    tracking_number: str | None
    campaign_hashtag: str | None
    finalized_at: datetime | None
    created_at: datetime

    @field_serializer("apply_open_at", "apply_close_at", "created_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("finalized_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminBrandDetail(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    brand_name: str
    company_email: str
    intent_message: str | None
    instagram_handle: str | None
    status: str
    user_status: str
    password_set: bool
    approved_at: datetime | None
    created_at: datetime
    last_login_at: datetime | None
    impersonatable: bool
    invite: AdminInviteState
    drops: list[AdminDropItem]

    @field_serializer("created_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("approved_at", "last_login_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


# ── Drops ───────────────────────────────────────────────────────────────────


class AdminApplicantItem(CamelModel):
    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    org_name: str
    university: str
    instagram_handle: str | None
    follower_count: int | None
    delivery_address: str | None
    account_erased: bool = False
    decision: str
    allocated_units: int | None
    pitch: str | None
    tracking_number: str | None
    linked_post_count: int
    applied_at: datetime
    decision_at: datetime | None

    @field_serializer("applied_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("decision_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminTrackerEventItem(CamelModel):
    id: uuid.UUID
    stage: str
    note: str | None
    occurred_at: datetime

    @field_serializer("occurred_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)


class AdminDropDetail(CamelModel):
    id: uuid.UUID
    brand_id: uuid.UUID
    brand_name: str
    brand_status: str
    brand_instagram_handle: str | None
    title: str
    description: str
    image: str
    location: str
    stage: str
    capacity_total: int
    total_product_units: int | None
    allocated_units: int
    campaign_hashtag: str | None
    tracking_number: str | None
    manual_reopen: bool
    apply_open_at: datetime
    apply_close_at: datetime
    finalized_at: datetime | None
    created_at: datetime
    linked_post_count: int
    pending_suggestion_count: int
    applicants: list[AdminApplicantItem]
    tracker_events: list[AdminTrackerEventItem]

    @field_serializer("apply_open_at", "apply_close_at", "created_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("finalized_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)
