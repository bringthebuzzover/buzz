"""Pydantic models for the drops surface (architecture.md §5.5, §7.1).

Responses are **camelCase** with **epoch-ms** datetimes (see ``schemas.common``)
so they match the frontend ``Drop`` TypeScript type field-for-field. Only the
fields the org surface actually renders are exposed; brand/fulfillment fields
(e.g. ``brandTrackerStage``, whose backend and frontend enum vocabularies
differ) are intentionally omitted on the org feed/detail until the Stage 5
brand surface + Stage 6 frontend reconcile them.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import field_serializer, field_validator

from app.schemas.common import CamelModel, to_epoch_ms

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
    accepted_count: int
    already_applied: bool

    @field_serializer("apply_open_at", "apply_close_at")
    def _epoch(self, value: datetime) -> int | None:
        return to_epoch_ms(value)


class DropDetailResponse(CamelModel):
    """A single drop for the org-facing detail view (architecture §7.1).

    Superset of the feed item: adds ``brand_id``, ``total_product_units`` and
    ``created_at``. Still omits ``brand_tracker_stage`` (org status is derived
    on the campaigns surface, not the drop detail).
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
    total_product_units: int | None
    created_at: datetime
    accepted_count: int
    already_applied: bool

    @field_serializer("apply_open_at", "apply_close_at", "created_at")
    def _epoch(self, value: datetime) -> int | None:
        return to_epoch_ms(value)


class ApplicationResponse(CamelModel):
    """A ``drop_applications`` row (architecture §3.1) returned on apply."""

    id: uuid.UUID
    drop_id: uuid.UUID
    org_id: uuid.UUID
    decision: str
    pitch: str | None
    tracking_number: str | None
    allocated_units: int | None
    applied_at: datetime
    decision_at: datetime | None

    @field_serializer("applied_at", "decision_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class DropApplyRequest(CamelModel):
    """Body for ``POST /api/drops/{id}/apply`` (architecture §7.1)."""

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
