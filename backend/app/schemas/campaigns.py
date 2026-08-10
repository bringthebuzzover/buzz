"""Pydantic models for the org "My Campaigns" surface (architecture.md §7.2/§7.3).

Each campaign is a ``drop_applications`` row joined with its parent ``drops``
row. ``brand_tracker_stage`` is passed through **raw** (the frontend derives the
org-facing ``OrgCampaignStatus`` from it in Stage 6); denied applications are
never serialized here (filtered in the service).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import field_serializer

from app.schemas.common import CamelModel, to_epoch_ms, to_epoch_ms_required


class CampaignListItem(CamelModel):
    """One row of ``GET /api/campaigns`` (application + joined drop fields)."""

    id: uuid.UUID
    drop_id: uuid.UUID
    decision: str
    pitch: str | None
    tracking_number: str | None
    allocated_units: int | None
    applied_at: datetime
    decision_at: datetime | None
    title: str
    brand_name: str
    brand_tracker_stage: str
    image: str

    @field_serializer("applied_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("decision_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class CampaignDetailResponse(CamelModel):
    """``GET /api/campaigns/{id}`` — full application joined with the drop."""

    id: uuid.UUID
    drop_id: uuid.UUID
    org_id: uuid.UUID
    decision: str
    pitch: str | None
    tracking_number: str | None
    allocated_units: int | None
    applied_at: datetime
    decision_at: datetime | None
    title: str
    description: str | None
    brand_name: str
    image: str
    brand_tracker_stage: str
    apply_open_at: datetime
    apply_close_at: datetime
    capacity_total: int
    total_product_units: int | None

    @field_serializer("applied_at", "apply_open_at", "apply_close_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("decision_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)
