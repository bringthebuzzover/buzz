"""Pydantic models for the drops surface (buzz-ops engineering/architecture.md §5.5, §7.1).

Responses are **camelCase** with **epoch-ms** datetimes (see ``schemas.common``)
so they match the frontend ``Drop`` TypeScript type field-for-field. Only the
fields the org surface actually renders are exposed; brand/fulfillment fields
(e.g. ``brandTrackerStage``, whose backend and frontend enum vocabularies
differ) are intentionally omitted on the org feed/detail until the Stage 5
brand surface + Stage 6 frontend reconcile them.
"""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta, timezone

from pydantic import ConfigDict, Field, field_serializer, field_validator
from pydantic.alias_generators import to_camel

from app.schemas.common import CamelModel, to_epoch_ms, to_epoch_ms_required
from app.schemas.shipments import ShipmentItem

_REMINDER_CHOICES = (5, 15, 60)


class DropFeedItem(CamelModel):
    """One drop as the org browse feed renders it (architecture §7.1).

    ``accepted_count`` and ``already_applied`` are server-computed: the former
    drives the "spots remaining"/full state, the latter is true when the caller
    org has a non-denied application on the drop (mirrors the demo's rule).
    """

    id: uuid.UUID
    brand_name: str
    title: str
    description: str
    image: str
    location: str
    capacity_total: int
    apply_open_at: datetime
    apply_close_at: datetime
    manual_reopen: bool
    applicant_selection_finalized_at: datetime | None
    accepted_count: int
    already_applied: bool
    # Notify-Me state for the caller org (§6.3.1): whether a reminder is set and
    # its lead time, so the Upcoming card shows the already-subscribed state from
    # the server on revisit rather than reverting to "Notify Me".
    notify_requested: bool
    reminder_minutes: int | None

    @field_serializer("apply_open_at", "apply_close_at")
    def _epoch_required(self, value: datetime) -> int:
        # Required datetimes must stay non-null in OpenAPI/TS (not int | null).
        return to_epoch_ms_required(value)

    @field_serializer("applicant_selection_finalized_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class DropDetailResponse(CamelModel):
    """A single drop for the org-facing detail view (architecture §7.1).

    Superset of the feed item: adds ``brand_id``, ``total_product_units`` and
    ``created_at``, plus the same notify-me fields as the feed so the detail
    surface can show subscribed state without a second lookup. Still omits
    ``brand_tracker_stage`` (org status is derived on the campaigns surface).
    """

    id: uuid.UUID
    brand_id: uuid.UUID
    brand_name: str
    title: str
    description: str
    image: str
    location: str
    capacity_total: int
    apply_open_at: datetime
    apply_close_at: datetime
    manual_reopen: bool
    applicant_selection_finalized_at: datetime | None
    total_product_units: int | None
    created_at: datetime
    accepted_count: int
    already_applied: bool
    notify_requested: bool
    reminder_minutes: int | None
    intent_status: str | None = None
    intent_pitch: str | None = None

    @field_serializer("apply_open_at", "apply_close_at", "created_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("applicant_selection_finalized_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class ApplicationResponse(CamelModel):
    """A ``drop_applications`` row (architecture §3.1) returned on apply."""

    id: uuid.UUID
    drop_id: uuid.UUID
    org_id: uuid.UUID
    decision: str
    pitch: str | None
    shipments: list[ShipmentItem]
    allocated_units: int | None
    applied_at: datetime
    decision_at: datetime | None

    @field_serializer("applied_at", "decision_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class DropApplyRequest(CamelModel):
    """Body for ``POST /api/drops/{id}/apply`` (architecture §7.1)."""

    pitch: str | None = None


class DropIntentPitchRequest(CamelModel):
    """Body for ``PATCH /api/drops/{id}/intent`` (pending org pitch)."""

    pitch: str | None = None


class NotifyRequest(CamelModel):
    """Body for ``POST /api/drops/{id}/notify`` (architecture §7.1)."""

    reminder_minutes: int

    @field_validator("reminder_minutes")
    @classmethod
    def _whitelist(cls, value: int) -> int:
        if value not in _REMINDER_CHOICES:
            raise ValueError(f"reminder_minutes must be one of {_REMINDER_CHOICES}")
        return value


# --- Brand-facing schemas (Stage 5C / Phase B) ---------------------------------

_HASHTAG_RE = re.compile(r"^[A-Za-z0-9_]{1,100}$")
_TARGET_DATE_HORIZON_DAYS = 365


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class BrandDropRequestCreate(CamelModel):
    """Body for ``POST /api/brands/me/drop-requests`` (PRODUCT §5.2).

    ``message`` and ``product`` are required. Every other field may be omitted.
    Unknown keys are rejected. Length and range checks run after strip.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    message: str = Field(min_length=1, max_length=4000)
    product: str = Field(min_length=1, max_length=1000)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    location: str | None = Field(default=None, max_length=255)
    target_date: date | None = None
    org_count: int | None = Field(default=None, ge=1, le=200)
    units_per_org: int | None = Field(default=None, ge=1, le=10_000)
    campaign_hashtag: str | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("message", "product", mode="before")
    @classmethod
    def _strip_required(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("title", "location", "notes", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("target_date", mode="before")
    @classmethod
    def _blank_date(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @field_validator("target_date")
    @classmethod
    def _target_window(cls, value: date | None) -> date | None:
        if value is None:
            return None
        today = datetime.now(timezone.utc).date()
        latest = today + timedelta(days=_TARGET_DATE_HORIZON_DAYS)
        if value < today or value > latest:
            raise ValueError("targetDate must be between today and 365 days from today (UTC)")
        return value

    @field_validator("campaign_hashtag", mode="before")
    @classmethod
    def _normalize_hashtag(cls, value: object) -> object:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        raw = value.strip()
        if not raw:
            return None
        normalized = raw.lstrip("#").strip()
        if _HASHTAG_RE.fullmatch(normalized) is None:
            raise ValueError("campaignHashtag must be 1-100 letters, numbers, or underscores")
        return normalized


class BrandDropRequestResponse(CamelModel):
    """A brand intake ticket (not a live drop).

    Structured fields are nullable: tickets filed before they existed only
    have ``message`` and ``notes``.
    """

    id: uuid.UUID
    brand_id: uuid.UUID
    message: str
    product: str | None
    title: str | None
    location: str | None
    target_date: date | None
    org_count: int | None
    units_per_org: int | None
    campaign_hashtag: str | None
    notes: str | None
    status: str
    converted_drop_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def _epoch(self, value: datetime) -> int:
        return to_epoch_ms_required(value)
