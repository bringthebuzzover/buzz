"""Brand portal orchestration (buzz-ops engineering/architecture.md §8.1–§8.4).

Pure service functions (no FastAPI types) the route layer calls. Brand-facing
endpoints gate on ``_require_brand`` (active brand must have a ``brands`` row,
otherwise the invariant is broken → 500).
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, BrandStatus, DropStage, OrgUserStatus
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.social_post import SocialPost
from app.models.user import User
from app.schemas.brands import (
    BrandDropCreativePatch,
    BrandDropDetailApplicant,
    BrandDropDetailResponse,
    BrandDropListItem,
    BrandDropPostItem,
)
from app.services.drop_image import validate_https_image
from app.services.erased_org_participation import TOMBSTONE_ORG_NAME
from app.services.lifecycle import drop_stage, reject_if_canceled, seat_in_report
from app.services.shipments import shipments_by_application_ids

logger = logging.getLogger(__name__)


async def _require_brand(db: AsyncSession, user: User) -> Brand:
    """Resolve the caller's brand profile.

    ``CurrentBrand`` already guarantees role=brand + active user, so an active
    brand with no ``brands`` row is an invariant violation → 500 (same
    pattern as ``_require_org`` in ``drops.py``).

    Also re-check ``brand.status`` here (defense-in-depth): the user-status gate
    can't see a brand that was un-approved after login, so a future admin-revoke
    flow can't leave a live session with portal access.
    """

    brand = await db.scalar(select(Brand).where(Brand.user_id == user.id))
    if brand is None:
        raise BuzzAPIException(
            errors.INTERNAL_ERROR,
            "Active brand account is missing its profile.",
            status_code=500,
        )
    if brand.status != BrandStatus.APPROVED.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "This brand account is not approved.",
            status_code=403,
        )
    return brand


async def resolve_brand_drop(db: AsyncSession, brand: Brand, drop_id: UUID) -> Drop:
    """Load a drop owned by *brand* or raise 404 (no existence leak)."""

    drop = await db.get(Drop, drop_id)
    if drop is None or drop.brand_id != brand.id or drop.hidden_at is not None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)
    return drop


def _metrics_frozen_at(posts: Sequence[SocialPost]) -> datetime | None:
    stamps = [post.metrics_frozen_at for post in posts if post.metrics_frozen_at is not None]
    return max(stamps) if stamps else None


# Brand wire shape for a frozen post: no permalink, media, or profile insights.
_FROZEN_POST_WIRE = {
    "url": "",
    "caption": "",
    "media_url": None,
    "thumbnail_url": None,
    "total_interactions": None,
    "profile_visits": None,
    "profile_activity": None,
    "follows": None,
    "ig_reels_avg_watch_time": None,
    "ig_reels_video_view_total_time": None,
    "reels_skip_rate": None,
}


def _brand_post_item(post: SocialPost, *, anonymize: bool) -> BrandDropPostItem:
    item = BrandDropPostItem.model_validate(post, from_attributes=True)
    if anonymize or post.metrics_frozen_at is not None:
        return item.model_copy(update=_FROZEN_POST_WIRE)
    return item


def _brand_drop_fields(
    drop: Drop, brand: Brand, agg: dict[str, int], stage: DropStage
) -> dict[str, Any]:
    """Fields shared by the brand drop list item and the brand drop detail."""

    return {
        "id": drop.id,
        "brand_id": drop.brand_id,
        "brand_name": brand.brand_name,
        "title": drop.title,
        "description": drop.description,
        "image": drop.image,
        "location": drop.location,
        "capacity_total": drop.capacity_total,
        "apply_open_at": drop.apply_open_at,
        "apply_close_at": drop.apply_close_at,
        "stage": stage,
        "total_product_units": drop.total_product_units,
        "campaign_hashtag": drop.campaign_hashtag,
        "created_at": drop.created_at,
        **agg,
    }


async def build_brand_drop_list_item(
    db: AsyncSession, brand: Brand, drop: Drop, stage: DropStage
) -> BrandDropListItem:
    """One row of ``GET /api/brands/me/drops``."""

    agg = await _drop_aggregate(db, drop.id)
    return BrandDropListItem(**_brand_drop_fields(drop, brand, agg, stage))


async def build_brand_drop_detail(
    db: AsyncSession, brand: Brand, drop: Drop
) -> BrandDropDetailResponse:
    """Same payload as ``GET /api/brands/me/drops/{drop_id}``."""

    agg = await _drop_aggregate(db, drop.id)
    rows = list(
        await db.execute(
            select(DropApplication, Organization, User)
            .join(Organization, Organization.id == DropApplication.org_id)
            .join(User, User.id == Organization.user_id)
            .where(DropApplication.drop_id == drop.id)
        )
    )

    shipment_map = await shipments_by_application_ids(db, [app.id for app, _, _ in rows])
    applicants: list[BrandDropDetailApplicant] = []
    for app, org, org_user in rows:
        attr = await _org_attributed_totals(db, app.id)
        posts = await _application_linked_posts(db, app.id)
        erased = org_user.status == OrgUserStatus.ERASED.value
        applicants.append(
            BrandDropDetailApplicant(
                id=app.id,
                drop_id=app.drop_id,
                org_id=app.org_id,
                decision=app.decision,
                pitch=None if erased else app.pitch,
                shipments=shipment_map.get(app.id, []),
                allocated_units=app.allocated_units,
                applied_at=app.applied_at,
                decision_at=app.decision_at,
                decision_sent_at=app.decision_sent_at,
                delivered_at=app.delivered_at,
                org_name=TOMBSTONE_ORG_NAME if erased else org.org_name,
                university="" if erased else org.university,
                instagram_handle="" if erased else (org_user.instagram_username or ""),
                follower_count=None if erased else org.follower_count,
                member_count=None if erased else org.member_count,
                category=None if erased else org.category,
                delivery_address=(
                    None
                    if erased
                    else (
                        org.delivery_address
                        if app.decision
                        in (
                            ApplicationDecision.APPLIED.value,
                            ApplicationDecision.ACCEPTED.value,
                        )
                        else None
                    )
                ),
                account_erased=erased,
                metrics_frozen_at=_metrics_frozen_at(posts),
                attributed_post_count=attr["attributed_post_count"],
                attributed_likes=attr["attributed_likes"],
                attributed_comments=attr["attributed_comments"],
                attributed_engagement=attr["attributed_engagement"],
                posts=[_brand_post_item(post, anonymize=erased) for post in posts],
            )
        )

    return BrandDropDetailResponse(
        **_brand_drop_fields(drop, brand, agg, await drop_stage(db, drop)),
        brand_can_edit_creative=drop.brand_can_edit_creative,
        published_at=drop.published_at,
        applications=applicants,
    )


async def update_brand_drop_creative(
    db: AsyncSession, drop: Drop, payload: BrandDropCreativePatch
) -> None:
    """Apply brand title/description/image when ``brand_can_edit_creative`` is on."""

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return

    reject_if_canceled(drop)
    if not drop.brand_can_edit_creative:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Brand cannot edit campaign creative on this drop.",
            status_code=403,
        )

    if "image" in updates:
        updates["image"] = validate_https_image(updates["image"])

    for key in ("title", "description"):
        if key in updates and isinstance(updates[key], str):
            updates[key] = updates[key].strip()

    logger.info(
        "brand drop creative patch drop_id=%s fields=%s",
        drop.id,
        sorted(updates.keys()),
    )
    for field, value in updates.items():
        setattr(drop, field, value)
    await db.flush()


# --- Per-drop aggregate (port of computeDropAggregate from metrics.ts) ---------


async def _drop_aggregate(db: AsyncSession, drop_id: UUID) -> dict[str, int]:
    linked_post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id)
            .join(DropApplication, DropApplication.id == PostCampaignLink.application_id)
            .where(DropApplication.drop_id == drop_id, seat_in_report())
        )
    )

    total_posts = len(linked_post_ids)
    total_likes, total_comments, total_reach = 0, 0, 0
    if linked_post_ids:
        totals_row = (
            await db.execute(
                select(
                    func.coalesce(func.sum(SocialPost.likes), 0),
                    func.coalesce(func.sum(SocialPost.comments), 0),
                    func.coalesce(func.sum(SocialPost.reach), 0),
                ).where(SocialPost.id.in_(linked_post_ids))
            )
        ).first()
        if totals_row is not None:
            total_likes, total_comments, total_reach = (int(v) for v in totals_row)

    return {
        "total_posts": total_posts,
        "total_likes": int(total_likes),
        "total_comments": int(total_comments),
        "total_engagement": int(total_likes) + int(total_comments),
        "total_reach": int(total_reach),
    }


# --- Org attributed campaign totals (port of computeOrgAttributedCampaignTotals)


async def _org_attributed_totals(db: AsyncSession, application_id: UUID) -> dict[str, int]:
    """Sum likes/comments across posts linked to one application row.

    Deny+reapply leaves two application rows for the same org+drop; totals must
    stay scoped to the row being rendered (same rule as ``_application_linked_posts``).
    """

    linked_post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id).where(
                PostCampaignLink.application_id == application_id
            )
        )
    )
    post_count = len(linked_post_ids)
    if linked_post_ids:
        totals_row = (
            await db.execute(
                select(
                    func.coalesce(func.sum(SocialPost.likes), 0),
                    func.coalesce(func.sum(SocialPost.comments), 0),
                ).where(SocialPost.id.in_(linked_post_ids))
            )
        ).first()
        if totals_row is not None:
            likes, comments = int(totals_row[0]), int(totals_row[1])
        else:
            likes, comments = 0, 0
    else:
        likes, comments = 0, 0

    return {
        "attributed_post_count": post_count,
        "attributed_likes": likes,
        "attributed_comments": comments,
        "attributed_engagement": likes + comments,
    }


async def _application_linked_posts(db: AsyncSession, application_id: UUID) -> list[SocialPost]:
    """Individual social posts linked to one application row.

    Feeds the brand's "posts grouped by org" per-drop view (§5.3.1). Keyed on the
    specific application (not the org) so an org holding more than one row on a
    drop — e.g. a denied row plus a re-applied row, allowed by the partial unique
    index — doesn't render another row's posts. Newest first.
    """

    post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id).where(
                PostCampaignLink.application_id == application_id
            )
        )
    )
    if not post_ids:
        return []
    return list(
        await db.scalars(
            select(SocialPost)
            .where(SocialPost.id.in_(post_ids))
            .order_by(SocialPost.posted_at.desc(), SocialPost.id.desc())
        )
    )


# --- Brand aggregate (port of computeBrandAggregate from metrics.ts) -----------


async def compute_brand_aggregate(db: AsyncSession, brand: Brand) -> dict[str, int]:
    drop_ids = list(
        await db.scalars(select(Drop.id).where(Drop.brand_id == brand.id, Drop.hidden_at.is_(None)))
    )
    if not drop_ids:
        return {
            "total_drops": 0,
            "total_posts": 0,
            "total_likes": 0,
            "total_comments": 0,
            "total_engagement": 0,
            "total_reach": 0,
            "total_orgs": 0,
            "total_campuses": 0,
        }

    total_drops = len(drop_ids)
    total_posts = 0
    total_likes = 0
    total_comments = 0
    total_reach = 0
    org_ids_all: set[UUID] = set()
    campus_set: set[str] = set()

    for drop_id in drop_ids:
        agg = await _drop_aggregate(db, drop_id)
        total_posts += agg["total_posts"]
        total_likes += agg["total_likes"]
        total_comments += agg["total_comments"]
        total_reach += agg["total_reach"]

        # Accepted orgs for this drop
        rows = list(
            await db.execute(
                select(Organization.id, Organization.university)
                .join(DropApplication, DropApplication.org_id == Organization.id)
                .where(
                    DropApplication.drop_id == drop_id,
                    DropApplication.decision == ApplicationDecision.ACCEPTED.value,
                )
            )
        )
        for org_id, university in rows:
            org_ids_all.add(org_id)
            if university:
                campus_set.add(university)

    return {
        "total_drops": total_drops,
        "total_posts": total_posts,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_engagement": total_likes + total_comments,
        "total_reach": total_reach,
        "total_orgs": len(org_ids_all),
        "total_campuses": len(campus_set),
    }


# --- Engagement time series (port of computeEngagementTimeSeries) -------------


async def compute_engagement_series(
    db: AsyncSession,
    brand: Brand,
    *,
    bucket_count: int = 12,
    window_days: int = 14,
) -> list[dict[str, int]]:
    """Cumulative likes+comments over time, bucketed by ``posted_at``.

    Uses post time (not ``metrics_updated_at``) so a metric sync does not cliff
    all engagement into the last bucket. Includes linked posts that have
    likes/comments even when insights are partial.
    """

    window_ms = window_days * 24 * 60 * 60 * 1000

    drop_ids = list(
        await db.scalars(select(Drop.id).where(Drop.brand_id == brand.id, Drop.hidden_at.is_(None)))
    )
    if not drop_ids:
        return []

    linked_post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id)
            .join(DropApplication, DropApplication.id == PostCampaignLink.application_id)
            .where(DropApplication.drop_id.in_(drop_ids))
        )
    )
    if not linked_post_ids:
        return []

    posts = list(
        await db.scalars(
            select(SocialPost)
            .where(SocialPost.id.in_(linked_post_ids))
            .order_by(SocialPost.posted_at.asc())
        )
    )
    if not posts:
        return []

    timestamps = [p.posted_at for p in posts]
    latest_ts = max(timestamps)
    window_end = latest_ts
    start = window_end - timedelta(milliseconds=window_ms)
    step = window_ms / bucket_count

    series: list[dict[str, int]] = []
    cursor = 0
    cumulative = 0

    for i in range(bucket_count):
        bucket_end = start + timedelta(milliseconds=(i + 1) * step)
        while cursor < len(posts):
            p = posts[cursor]
            ts = p.posted_at
            if ts > bucket_end:
                break
            cumulative += (p.likes or 0) + (p.comments or 0)
            cursor += 1
        series.append(
            {
                "timestamp": int(bucket_end.timestamp() * 1000),
                "engagement": cumulative,
            }
        )

    return series
