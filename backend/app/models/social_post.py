"""``social_posts`` table — one org's IG/TikTok post + cached metrics.

* ``UNIQUE(org_id, platform, external_id)`` keeps repeated ``/me/media`` syncs
  idempotent per org (§3.2) without blocking two orgs that somehow share a
  platform media id.
* ``metrics_updated_at`` nullable so the metric sync job (§10.1) can pick
  "never refreshed" rows on first run; the job only touches posts where
  ``posted_at >= now() - 30 days``.
* ``insights_raw`` is **JSONB**, not JSON: indexable for forward-compat
  queries against new insight metrics without an ALTER.
* ``reels_skip_rate`` is ``Float`` per the spec; switch to ``Numeric(5, 4)``
  later only if billing-grade decimal math becomes a requirement.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import PlatformEnum, SocialMediaProductTypeEnum, SocialMediaTypeEnum


class SocialPost(Base):
    __tablename__ = "social_posts"
    __table_args__ = (
        sa.UniqueConstraint(
            "org_id",
            "platform",
            "external_id",
            name="uq_social_posts_org_platform_external_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=False
    )

    platform: Mapped[str] = mapped_column(PlatformEnum, nullable=False)
    external_id: Mapped[str] = mapped_column(sa.String(255), nullable=False)

    url: Mapped[str] = mapped_column(sa.String(1024), nullable=False)
    media_url: Mapped[str | None] = mapped_column(sa.String(1024), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(sa.String(1024), nullable=True)
    caption: Mapped[str] = mapped_column(sa.Text, nullable=False)

    media_type: Mapped[str] = mapped_column(SocialMediaTypeEnum, nullable=False)
    media_product_type: Mapped[str] = mapped_column(SocialMediaProductTypeEnum, nullable=False)

    posted_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)

    likes: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    comments: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))

    reach: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    views: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    saved: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    shares: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    reposts: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    total_interactions: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    profile_visits: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    profile_activity: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    follows: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    ig_reels_avg_watch_time: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    ig_reels_video_view_total_time: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    reels_skip_rate: Mapped[float | None] = mapped_column(sa.Float, nullable=True)

    insights_raw: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    metrics_updated_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
