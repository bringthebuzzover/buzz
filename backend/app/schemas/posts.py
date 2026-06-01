"""Pydantic models for the posts/links/suggestions surface (architecture §7.4).

Posts are returned with the insight columns **flattened** (matching the DB / IG
insights), not nested under a ``metrics`` object like the frontend ``SocialPost``
type — the Stage 6 adapter reconciles that (plan review S8). camelCase + epoch-ms
via ``schemas.common``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import field_serializer

from app.schemas.common import CamelModel, to_epoch_ms


class PostResponse(CamelModel):
    """One of the caller org's social posts (architecture §7.4.2).

    ``linked_application_id`` / ``linked_drop_id`` are the one-post-one-campaign
    indicator: non-null when the post is already attributed to a campaign (the
    frontend disables the checkbox / shows "Linked to another campaign").
    """

    id: uuid.UUID
    org_id: uuid.UUID
    platform: str
    external_id: str
    url: str
    media_url: str | None
    thumbnail_url: str | None
    caption: str
    media_type: str
    media_product_type: str
    posted_at: datetime
    likes: int
    comments: int
    reach: int | None
    views: int | None
    saved: int | None
    shares: int | None
    reposts: int | None
    total_interactions: int | None
    profile_visits: int | None
    profile_activity: int | None
    follows: int | None
    ig_reels_avg_watch_time: int | None
    ig_reels_video_view_total_time: int | None
    reels_skip_rate: float | None
    metrics_updated_at: datetime | None
    created_at: datetime
    linked_application_id: uuid.UUID | None = None
    linked_drop_id: uuid.UUID | None = None

    @field_serializer("posted_at", "metrics_updated_at", "created_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class CampaignAggregateResponse(CamelModel):
    """Per-campaign rollup (ports ``computeCampaignAggregate``, architecture §7.3).

    ``engagement = likes + comments``; ``estimated_reach`` is the org's follower
    count (v1 reach approximation).
    """

    post_count: int
    likes: int
    comments: int
    engagement: int
    estimated_reach: int


class SuggestionResponse(CamelModel):
    """A pending auto-link suggestion joined with its post (architecture §7.4.1)."""

    post_id: uuid.UUID
    url: str
    thumbnail_url: str | None
    caption: str
    posted_at: datetime
    likes: int
    comments: int
    match_reason: str
    match_evidence: str

    @field_serializer("posted_at")
    def _epoch(self, value: datetime) -> int | None:
        return to_epoch_ms(value)


class LinkPostRequest(CamelModel):
    """Body for ``POST|DELETE /api/campaigns/{id}/link-post``."""

    post_id: uuid.UUID
