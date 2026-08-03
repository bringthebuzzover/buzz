"""Brand portal orchestration (architecture.md §8.1–§8.4).

Pure service functions (no FastAPI types) the route layer calls. Brand-facing
endpoints gate on ``_require_brand`` (active brand must have a ``brands`` row,
otherwise the invariant is broken → 500).
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, BrandStatus, BrandTrackerStage
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.social_post import SocialPost
from app.models.user import User
from app.services.email import send_application_denied_email

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
    if drop is None or drop.brand_id != brand.id:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)
    return drop


# --- Per-drop aggregate (port of computeDropAggregate from metrics.ts) ---------


async def _drop_aggregate(db: AsyncSession, drop_id: UUID) -> dict[str, int]:
    accepted_org_ids = list(
        await db.scalars(
            select(DropApplication.org_id).where(
                DropApplication.drop_id == drop_id,
                DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            )
        )
    )
    linked_post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id)
            .join(DropApplication, DropApplication.id == PostCampaignLink.application_id)
            .where(
                PostCampaignLink.drop_id == drop_id,
                DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            )
        )
    )

    total_posts = len(linked_post_ids)
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
            total_likes, total_comments = int(totals_row[0]), int(totals_row[1])
        else:
            total_likes, total_comments = 0, 0
    else:
        total_likes, total_comments = 0, 0

    if accepted_org_ids:
        total_reach = (
            await db.scalar(
                select(func.coalesce(func.sum(Organization.follower_count), 0)).where(
                    Organization.id.in_(accepted_org_ids)
                )
            )
            or 0
        )
    else:
        total_reach = 0

    return {
        "total_posts": total_posts,
        "total_likes": int(total_likes),
        "total_comments": int(total_comments),
        "total_engagement": int(total_likes) + int(total_comments),
        "total_reach": int(total_reach),
    }


# --- Org attributed campaign totals (port of computeOrgAttributedCampaignTotals)


async def _org_attributed_totals(db: AsyncSession, org_id: UUID, drop_id: UUID) -> dict[str, int]:
    """Sum likes/comments across posts linked to *org_id*'s applications on *drop_id*."""

    app_ids = list(
        await db.scalars(
            select(DropApplication.id).where(
                DropApplication.org_id == org_id,
                DropApplication.drop_id == drop_id,
            )
        )
    )
    if not app_ids:
        return {
            "attributed_post_count": 0,
            "attributed_likes": 0,
            "attributed_comments": 0,
            "attributed_engagement": 0,
        }

    linked_post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id).where(PostCampaignLink.application_id.in_(app_ids))
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
    drop_ids = list(await db.scalars(select(Drop.id).where(Drop.brand_id == brand.id)))
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
    org_ids_all: set[UUID] = set()
    campus_set: set[str] = set()

    for drop_id in drop_ids:
        agg = await _drop_aggregate(db, drop_id)
        total_posts += agg["total_posts"]
        total_likes += agg["total_likes"]
        total_comments += agg["total_comments"]

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
            campus_set.add(university)

    # Reach is the audience of the DISTINCT accepted orgs across all drops —
    # summing per-drop reach would double-count an org accepted on multiple
    # drops and contradict the (deduped) total_orgs (architecture.md §8.1).
    total_reach = 0
    if org_ids_all:
        total_reach = int(
            await db.scalar(
                select(func.coalesce(func.sum(Organization.follower_count), 0)).where(
                    Organization.id.in_(org_ids_all)
                )
            )
            or 0
        )

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
    window_ms = window_days * 24 * 60 * 60 * 1000

    drop_ids = list(await db.scalars(select(Drop.id).where(Drop.brand_id == brand.id)))
    if not drop_ids:
        return []

    linked_post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id).where(PostCampaignLink.drop_id.in_(drop_ids))
        )
    )
    if not linked_post_ids:
        return []

    posts = list(
        await db.scalars(
            select(SocialPost)
            .where(
                SocialPost.id.in_(linked_post_ids),
                SocialPost.metrics_updated_at.isnot(None),
            )
            .order_by(SocialPost.metrics_updated_at.asc())
        )
    )
    if not posts:
        return []

    # Anchor to latest post data, not request time
    # (posts with None metrics_updated_at are already filtered out above)
    timestamps = [p.metrics_updated_at for p in posts]
    assert None not in timestamps, "posts with null metrics_updated_at must be filtered"
    latest_ts = max(t for t in timestamps if t is not None)
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
            ts = p.metrics_updated_at
            if ts is None or ts > bucket_end:
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


# --- Finalize applicants (§8.3) ------------------------------------------------


async def finalize_applicants(
    db: AsyncSession,
    brand: Brand,
    drop_id: UUID,
    allocations: Sequence[dict[str, Any]],
) -> dict[str, int]:
    """Validate 7 rules then atomically accept/deny applicants.

    ``allocations`` items are ``{"org_id": UUID, "units": int}`` dicts.
    Returns a summary dict suitable for the route response.
    """

    # Lock the drop row to serialize concurrent finalize attempts (avoid
    # TOCTOU between rule checks and the accept/deny writes).
    drop = await db.scalar(
        select(Drop).where(Drop.id == drop_id, Drop.brand_id == brand.id).with_for_update()
    )
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

    # Validate no duplicate org_ids
    org_ids_in_alloc = [item["org_id"] for item in allocations]
    seen: set[UUID] = set()
    for oid in org_ids_in_alloc:
        if oid in seen:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                f"Duplicate org_id in allocations: {oid}",
                status_code=400,
            )
        seen.add(oid)

    # Rule 2: stage must be finalizing_agreements
    if drop.brand_tracker_stage != BrandTrackerStage.FINALIZING_AGREEMENTS.value:
        raise BuzzAPIException(
            errors.DROP_NOT_IN_SELECTION_STAGE,
            "Drop is not in the applicant selection stage.",
        )

    # Rule 3: apply window must be closed
    now = datetime.now(timezone.utc)
    if drop.apply_close_at.tzinfo is None:
        apply_close = drop.apply_close_at.replace(tzinfo=timezone.utc)
    else:
        apply_close = drop.apply_close_at
    if now <= apply_close:
        raise BuzzAPIException(
            errors.APPLY_WINDOW_OPEN,
            "Applications are still open for this drop.",
        )

    # Rule 4: not already finalized
    if drop.applicant_selection_finalized_at is not None:
        raise BuzzAPIException(
            errors.ALREADY_FINALIZED,
            "Applicant selection has already been finalized.",
        )

    # Rule 5: selected count ≤ capacity
    selected_count = len(allocations)
    if selected_count > drop.capacity_total:
        raise BuzzAPIException(
            errors.CAPACITY_EXCEEDED,
            f"Selected {selected_count} orgs exceeds capacity of {drop.capacity_total}.",
        )

    # Rule 6: unit budget (only when total_product_units is set)
    if drop.total_product_units is not None:
        sum_units = sum(item["units"] for item in allocations)
        if sum_units > drop.total_product_units:
            raise BuzzAPIException(
                errors.UNIT_BUDGET_EXCEEDED,
                f"Allocated {sum_units} units exceeds budget of {drop.total_product_units}.",
                details={"remaining": drop.total_product_units - sum_units},
            )

    # Rule 7: every allocated org must have an applied application
    applied_rows = list(
        await db.execute(
            select(DropApplication.org_id, DropApplication.id).where(
                DropApplication.drop_id == drop.id,
                DropApplication.decision == ApplicationDecision.APPLIED.value,
            )
        )
    )
    applied_org_ids = {row[0] for row in applied_rows}
    app_id_by_org = {row[0]: row[1] for row in applied_rows}

    selected_org_ids = set(org_ids_in_alloc)
    missing = selected_org_ids - applied_org_ids
    if missing:
        first_missing = next(iter(missing))
        raise BuzzAPIException(
            errors.ORG_NOT_APPLIED,
            f"Org {first_missing} has not applied to this drop.",
            details={"org_id": str(first_missing)},
        )

    # Atomic txn: accept selected, deny the rest
    allocation_by_org = {item["org_id"]: item["units"] for item in allocations}
    denied_count = 0
    denied_org_ids: set[UUID] = set()
    for org_id, app_id in app_id_by_org.items():
        if org_id in selected_org_ids:
            units = allocation_by_org[org_id] if drop.total_product_units is not None else None
            await db.execute(
                sa_update(DropApplication)
                .where(DropApplication.id == app_id)
                .values(
                    decision=ApplicationDecision.ACCEPTED.value,
                    allocated_units=units,
                    decision_at=now,
                )
            )
        else:
            await db.execute(
                sa_update(DropApplication)
                .where(DropApplication.id == app_id)
                .values(
                    decision=ApplicationDecision.DENIED.value,
                    decision_at=now,
                )
            )
            denied_count += 1
            denied_org_ids.add(org_id)

    drop.applicant_selection_finalized_at = now
    # Finalize closes the apply window for good — a leftover manual_reopen would
    # otherwise keep accepting applications under a finalized selection.
    drop.manual_reopen = False
    await db.flush()

    # PRODUCT §7.1: denied applicants get an email (their only channel — no row in
    # My Campaigns). Sent inline (matching the admin deny pattern); a per-org send
    # failure must not roll back the finalize, so swallow + log.
    if denied_org_ids:
        contacts = await db.execute(
            select(Organization.edu_email, Organization.org_name).where(
                Organization.id.in_(denied_org_ids)
            )
        )
        for edu_email, org_name in contacts.all():
            try:
                await send_application_denied_email(
                    edu_email,
                    org_name=org_name,
                    drop_title=drop.title,
                    brand_name=brand.brand_name,
                )
            except Exception:  # noqa: BLE001 — email best-effort; don't fail finalize
                logger.warning(
                    "application-denied email failed for %s on drop %s",
                    edu_email,
                    drop.id,
                    exc_info=True,
                )

    return {
        "finalized_count": len(applied_org_ids),
        "accepted_count": selected_count,
        "denied_count": denied_count,
    }
