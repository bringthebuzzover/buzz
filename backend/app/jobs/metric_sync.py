"""Instagram metric sync (architecture.md §10.1).

Daily. For each org with a live campaign and a valid long-lived token:

1. **Discovery** — ``GET /me/media`` (paged, capped) finds posts in the 30-day
   window; new ones are inserted (``metrics_updated_at = NULL``).
2. **Refresh** — for every refresh-eligible post (``posted_at >= now - 30d``,
   not a STORY), pull basic fields then insights separately. Basics
   (likes/comments/media URLs) persist even when insights fail.
   ``metrics_updated_at`` is stamped when basics succeed (including after an
   insights failure) so charts can include the post; insight columns update
   only on insights success.

Per-post / per-org failures don't block the batch (rate limits, deleted posts,
expired tokens). Posts older than 30 days are frozen (skipped). Idempotent via
``UNIQUE(platform, external_id)``.

Eligibility (``_LIVE_STAGES``) is intentional for this job: orgs need an accepted
application on ``awaiting_products`` / ``drop_active`` / ``drop_finished``. The
finalize → awaiting_products gap is a known sync blackout; do not expand stage
gating here without a product change.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    Platform,
    SocialMediaProductType,
)
from app.models.organization import Organization
from app.models.social_post import SocialPost
from app.models.user import User
from app.security.token_crypto import decrypt_token
from app.services.instagram import InstagramClient, MediaFields

logger = logging.getLogger(__name__)

_WINDOW = timedelta(days=30)
_LIVE_STAGES = (
    BrandTrackerStage.AWAITING_PRODUCTS.value,
    BrandTrackerStage.DROP_ACTIVE.value,
    BrandTrackerStage.DROP_FINISHED.value,
)
# insight name -> SocialPost column
_INSIGHT_COLUMNS = (
    "reach",
    "views",
    "saved",
    "shares",
    "reposts",
    "total_interactions",
    "profile_visits",
    "profile_activity",
    "follows",
    "ig_reels_avg_watch_time",
    "ig_reels_video_view_total_time",
)


def _parse_ts(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        # IG sometimes uses "+0000" without a colon on older formats.
        try:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
        except ValueError:
            return None


def _apply_basics(post: SocialPost, fields: MediaFields) -> None:
    post.caption = fields.caption
    post.likes = fields.like_count
    post.comments = fields.comments_count
    post.media_url = fields.media_url
    post.thumbnail_url = fields.thumbnail_url


def _apply_insights(post: SocialPost, insights: dict[str, int | float]) -> None:
    for col in _INSIGHT_COLUMNS:
        if col in insights:
            setattr(post, col, insights[col])
    if "reels_skip_rate" in insights:
        post.reels_skip_rate = float(insights["reels_skip_rate"])
    post.insights_raw = dict(insights)


def _apply_metrics(
    post: SocialPost, fields: MediaFields, insights: dict[str, int | float], now: datetime
) -> None:
    """Full apply (basics + insights + stamp) — used by tests and happy path."""

    _apply_basics(post, fields)
    _apply_insights(post, insights)
    post.metrics_updated_at = now


async def _eligible_orgs(db: AsyncSession, now: datetime) -> list[Organization]:
    """Orgs with at least one accepted application on a live-stage drop."""
    org_ids = (
        select(DropApplication.org_id)
        .join(Drop, Drop.id == DropApplication.drop_id)
        .where(
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            Drop.brand_tracker_stage.in_(_LIVE_STAGES),
        )
        .distinct()
    )
    return list(await db.scalars(select(Organization).where(Organization.id.in_(org_ids))))


def _token_for(user: User | None, now: datetime) -> str | None:
    if user is None or not user.instagram_access_token:
        return None
    exp = user.instagram_token_expires_at
    if exp is not None:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp <= now:
            return None  # expired — skip; on-login flow flags for re-auth
    try:
        return decrypt_token(user.instagram_access_token)
    except Exception:  # noqa: BLE001
        return None


async def sync_metrics(db: AsyncSession, ig: InstagramClient) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    window_start = now - _WINDOW

    orgs = await _eligible_orgs(db, now)
    discovered = 0
    refreshed = 0
    failed = 0
    skipped_token = 0

    for org in orgs:
        user = await db.get(User, org.user_id)
        token = _token_for(user, now)
        if token is None:
            # Present-but-unusable token → non-clean run (expired / undecryptable).
            if user is not None and user.instagram_access_token:
                logger.warning(
                    "metric sync skipped org %s: Instagram token missing/expired (needs re-auth)",
                    org.id,
                )
                skipped_token += 1
                failed += 1
            continue

        # --- Discovery: insert newly-posted media in the window ---
        try:
            media = await ig.fetch_user_media(token)
        except Exception:  # noqa: BLE001
            logger.warning("media list failed for org %s", org.id, exc_info=True)
            failed += 1
            media = []

        for ref in media:
            posted = _parse_ts(ref.timestamp)
            if posted is None or posted < window_start:
                continue
            exists = await db.scalar(
                select(func.count())
                .select_from(SocialPost)
                .where(
                    SocialPost.platform == Platform.INSTAGRAM.value,
                    SocialPost.external_id == ref.id,
                )
            )
            if exists:
                continue
            try:
                fields = await ig.fetch_media(token, ref.id)
            except Exception:  # noqa: BLE001
                failed += 1
                continue
            # Insert in a savepoint so a concurrent run losing the
            # UNIQUE(platform, external_id) race skips that post instead of
            # aborting the whole job's transaction.
            try:
                async with db.begin_nested():
                    db.add(
                        SocialPost(
                            org_id=org.id,
                            platform=Platform.INSTAGRAM.value,
                            external_id=ref.id,
                            url=fields.permalink,
                            media_url=fields.media_url,
                            thumbnail_url=fields.thumbnail_url,
                            caption=fields.caption,
                            media_type=fields.media_type,
                            media_product_type=fields.media_product_type,
                            posted_at=posted,
                            likes=fields.like_count,
                            comments=fields.comments_count,
                        )
                    )
            except IntegrityError:
                continue
            discovered += 1
        await db.flush()

        # --- Refresh: pull metrics for eligible posts (not STORY, in window) ---
        posts = list(
            await db.scalars(
                select(SocialPost).where(
                    SocialPost.org_id == org.id,
                    SocialPost.posted_at >= window_start,
                    SocialPost.platform == Platform.INSTAGRAM.value,
                    SocialPost.media_product_type != SocialMediaProductType.STORY.value,
                )
            )
        )
        for post in posts:
            is_reel = post.media_product_type == SocialMediaProductType.REELS.value
            try:
                fields = await ig.fetch_media(token, post.external_id)
            except Exception:  # noqa: BLE001
                failed += 1
                continue
            _apply_basics(post, fields)

            try:
                insights = await ig.fetch_media_insights(token, post.external_id, is_reel=is_reel)
            except Exception:  # noqa: BLE001
                # Basics kept; prior insight columns untouched; stamp so charts
                # include the post (LOCKED cluster approach).
                failed += 1
                post.metrics_updated_at = now
                refreshed += 1
                continue

            _apply_insights(post, insights)
            post.metrics_updated_at = now
            refreshed += 1
        await db.flush()

    return {
        "orgs": len(orgs),
        "posts_discovered": discovered,
        "posts_refreshed": refreshed,
        "failures": failed,
        "skipped_token": skipped_token,
    }
