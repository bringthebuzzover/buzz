"""Pydantic models for the brand surface (architecture.md §8.1–§8.4).

Responses are **camelCase** with **epoch-ms** datetimes (see ``schemas.common``)
so they match the frontend TypeScript types field-for-field.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import field_serializer, field_validator

from app.schemas.common import CamelModel, to_epoch_ms


class BrandProfileResponse(CamelModel):
    """Brand profile returned by ``GET /api/brands/me`` (architecture §5.1)."""

    id: uuid.UUID
    brand_name: str
    company_email: str
    intent_message: str | None
    instagram_handle: str | None
    status: str
    approved_at: datetime | None
    created_at: datetime

    @field_serializer("approved_at", "created_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class BrandDropListItem(CamelModel):
    """One drop in ``GET /api/brands/me/drops`` with per-drop aggregate fields."""

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
    brand_tracker_stage: str
    total_product_units: int | None
    campaign_hashtag: str | None
    applicant_selection_finalized_at: datetime | None
    created_at: datetime
    # Per-drop aggregate (from computeDropAggregate / metrics.ts)
    total_posts: int
    total_likes: int
    total_comments: int
    total_engagement: int
    total_reach: int

    @field_serializer(
        "apply_open_at",
        "apply_close_at",
        "applicant_selection_finalized_at",
        "created_at",
    )
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class BrandDropDetailApplicant(CamelModel):
    """One applicant row in the brand drop detail view (§8.2)."""

    id: uuid.UUID
    drop_id: uuid.UUID
    org_id: uuid.UUID
    decision: str
    pitch: str | None
    tracking_number: str | None
    allocated_units: int | None
    applied_at: datetime
    decision_at: datetime | None
    # Joined org profile
    org_name: str
    university: str
    instagram_handle: str
    follower_count: int | None
    member_count: int | None
    # Attributed campaign totals (likes/comments from linked posts)
    attributed_post_count: int
    attributed_likes: int
    attributed_comments: int
    attributed_engagement: int

    @field_serializer("applied_at", "decision_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class BrandDropDetailResponse(CamelModel):
    """Full drop detail for the brand portal (§8.2)."""

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
    brand_tracker_stage: str
    total_product_units: int | None
    campaign_hashtag: str | None
    applicant_selection_finalized_at: datetime | None
    created_at: datetime
    applications: list[BrandDropDetailApplicant]

    @field_serializer(
        "apply_open_at",
        "apply_close_at",
        "applicant_selection_finalized_at",
        "created_at",
    )
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class FinalizeAllocation(CamelModel):
    """One (org, units) entry in a finalize-applicants request (§8.3)."""

    org_id: uuid.UUID
    units: int = 0

    @field_validator("units")
    @classmethod
    def _non_negative(cls, value: int) -> int:
        if value < 0:
            raise ValueError("units must be >= 0")
        return value


class FinalizeApplicantsRequest(CamelModel):
    """Body for ``POST /api/brands/me/drops/{id}/finalize-applicants`` (§8.3)."""

    allocations: list[FinalizeAllocation]


class BrandAggregateResponse(CamelModel):
    """Aggregate metrics for a brand (§8.1)."""

    total_drops: int
    total_posts: int
    total_likes: int
    total_comments: int
    total_engagement: int
    total_reach: int
    total_orgs: int
    total_campuses: int


class EngagementSeriesPoint(CamelModel):
    """One bucket in the engagement time series (§8.1)."""

    timestamp: int
    engagement: int
