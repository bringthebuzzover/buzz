"""Pydantic models for the brand surface (architecture.md §8.1–§8.4).

Responses are **camelCase** with **epoch-ms** datetimes (see ``schemas.common``)
so they match the frontend TypeScript types field-for-field.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import ConfigDict, field_serializer, field_validator
from pydantic.alias_generators import to_camel

from app.schemas.common import CamelModel, to_epoch_ms, to_epoch_ms_required


class BrandApplyRequest(CamelModel):
    """Public brand self-registration body for ``POST /api/brands/apply``."""

    brand_name: str
    company_email: str
    instagram_handle: str | None = None
    intent_message: str | None = None

    @field_validator("company_email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1] or len(v) > 320:
            raise ValueError("Invalid email address")
        return v

    @field_validator("brand_name")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()


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

    @field_serializer("created_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("approved_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
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

    @field_serializer("apply_open_at", "apply_close_at", "created_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("applicant_selection_finalized_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class BrandDropPostItem(CamelModel):
    """One linked social post under an applicant (brand per-drop view, §5.3.1).

    The brand sees individual posts grouped by org (not just the per-org
    roll-up) so it can preview/attribute each contribution.
    """

    id: uuid.UUID
    url: str
    media_url: str | None
    thumbnail_url: str | None
    caption: str
    media_type: str
    media_product_type: str
    posted_at: datetime
    likes: int
    comments: int

    @field_serializer("posted_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)


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
    category: str | None
    delivery_address: str | None
    account_erased: bool = False
    # Attributed campaign totals (likes/comments from linked posts)
    attributed_post_count: int
    attributed_likes: int
    attributed_comments: int
    attributed_engagement: int
    # Individual linked posts, grouped under this org (§5.3.1)
    posts: list[BrandDropPostItem]

    @field_serializer("applied_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("decision_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
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
    brand_can_edit_creative: bool
    applicant_selection_finalized_at: datetime | None
    created_at: datetime
    tracking_number: str | None
    applications: list[BrandDropDetailApplicant]
    # Same roll-up as the list endpoint so live-stage KPI cards don't crash.
    total_posts: int
    total_likes: int
    total_comments: int
    total_engagement: int
    total_reach: int

    @field_serializer("apply_open_at", "apply_close_at", "created_at")
    def _epoch_required(self, value: datetime) -> int:
        return to_epoch_ms_required(value)

    @field_serializer("applicant_selection_finalized_at")
    def _epoch_optional(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class BrandDropCreativePatch(CamelModel):
    """Brand-owned title/description/image patch (omit = leave alone)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    title: str | None = None
    description: str | None = None
    image: str | None = None

    @field_validator("title", "description", "image")
    @classmethod
    def _required_not_null_non_blank(cls, value: object) -> object:
        if value is None:
            raise ValueError("must not be null")
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError("must not be blank")
            return stripped
        return value

    @field_validator("image")
    @classmethod
    def _reject_placeholder_image(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not value.startswith("https://"):
            raise ValueError("image must be an https:// URL")
        if "placehold.co" in value.lower():
            raise ValueError("placeholder images are not allowed")
        return value


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
