"""Instagram metric sync (architecture.md §10.1).

Daily. For each org with a live campaign and a valid long-lived token:

1. **Discovery** — ``GET /me/media`` (paged, capped) finds posts in the 30-day
   window; new ones are inserted (``metrics_updated_at = NULL``).
2. **Refresh** — for every refresh-eligible post (``posted_at >= now - 30d``,
   not a STORY), pull basic fields then insights separately. Basics
   (likes/comments/media URLs) persist even when insights fail. If Graph omits
   ``like_count`` / ``comments_count``, prior DB values are carried (not zeroed);
   present ``0`` still overwrites. Counters ``likes_omitted`` /
   ``comments_omitted`` land in the job summary.
   ``metrics_updated_at`` is stamped when basics succeed (including after an
   insights failure) so charts can include the post; insight columns update
   only on insights success.
3. **Follower counts** — after media sync, refresh ``organizations.follower_count``
   from Graph ``followers_count`` for **every** non-erased org user with a usable
   token (not only live-stage campaign orgs). Omit/null/fail keep prior values;
   summary counters ``followers_refreshed`` / ``followers_omitted`` /
   ``followers_failed``.

Stories are unsupported (v1): discovery skips ``media_product_type == STORY``;
there is no ``/stories`` poller. See ``gaps/posts.stories-unsupported`` / META.md.

Per-post / per-org failures don't block the batch (rate limits, deleted posts,
expired tokens). Posts older than 30 days are frozen (skipped). Idempotent via
``UNIQUE(org_id, platform, external_id)``.

Media eligibility (``_LIVE_STAGES``) is intentional for discovery/refresh: orgs
need an accepted application on ``awaiting_products`` / ``drop_active`` /
``drop_finished``. Follower refresh is broader (any tokened org). The finalize →
awaiting_products gap remains a media-sync blackout only.
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
    OrgUserStatus,
    Platform,
    PortalRole,
    SocialMediaProductType,
)
from app.models.organization import Organization
from app.models.social_post import SocialPost
from app.models.user import User
from app.security.token_crypto import TokenDecryptionError, decrypt_token
from app.services.instagram import InstagramClient, MediaFields
from app.services.instagram_token import clear_unusable_instagram_token

logger = logging.getLogger(__name__)

# Exported for admin health (must stay aligned with the sync lookback).
METRIC_WINDOW_DAYS = 30
_WINDOW = timedelta(days=METRIC_WINDOW_DAYS)
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


def _apply_basics(post: SocialPost, fields: MediaFields) -> tuple[bool, bool]:
    """Apply caption/media URLs and engagement when present.

    Returns ``(likes_omitted, comments_omitted)`` — omitted Graph keys keep the
    prior DB value (real ``0`` still overwrites).
    """

    post.caption = fields.caption
    post.media_url = fields.media_url
    post.thumbnail_url = fields.thumbnail_url

    likes_omitted = False
    comments_omitted = False
    if fields.like_count is None:
        likes_omitted = True
        logger.warning(
            "metric sync omitted like_count org_id=%s post_id=%s external_id=%s previous=%s",
            post.org_id,
            post.id,
            post.external_id,
            post.likes,
        )
    else:
        post.likes = fields.like_count
    if fields.comments_count is None:
        comments_omitted = True
        logger.warning(
            "metric sync omitted comments_count org_id=%s post_id=%s external_id=%s previous=%s",
            post.org_id,
            post.id,
            post.external_id,
            post.comments,
        )
    else:
        post.comments = fields.comments_count
    return likes_omitted, comments_omitted


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
    """Orgs with at least one accepted application on a live-stage drop.

    Erased accounts are excluded so Meta cannot rehydrate scrubbed identity
    via discovery (PRODUCT §3.1.2).
    """
    org_ids = (
        select(DropApplication.org_id)
        .join(Drop, Drop.id == DropApplication.drop_id)
        .join(Organization, Organization.id == DropApplication.org_id)
        .join(User, User.id == Organization.user_id)
        .where(
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            Drop.brand_tracker_stage.in_(_LIVE_STAGES),
            User.status != OrgUserStatus.ERASED.value,
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
    except TokenDecryptionError:
        clear_unusable_instagram_token(user)
        return None
    except Exception:  # noqa: BLE001
        return None


async def _refresh_follower_counts(
    db: AsyncSession, ig: InstagramClient, now: datetime
) -> dict[str, int]:
    """Refresh ``organizations.follower_count`` from Graph for tokened orgs.

    Walks all non-erased org users with a usable token (not only live-stage
    campaign eligibility). Omit/null/fail keep the prior DB value.
    """

    refreshed = 0
    omitted = 0
    failed = 0

    users = list(
        await db.scalars(
            select(User).where(
                User.portal_role == PortalRole.ORG.value,
                User.status != OrgUserStatus.ERASED.value,
                User.instagram_access_token.isnot(None),
            )
        )
    )
    for user in users:
        token = _token_for(user, now)
        if token is None:
            continue
        org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
        if org is None:
            continue
        try:
            profile = await ig.fetch_profile(token)
        except Exception:  # noqa: BLE001
            failed += 1
            logger.warning(
                "metric sync followers_failed org_id=%s user_id=%s previous=%s reason=fetch_error",
                org.id,
                user.id,
                org.follower_count,
            )
            continue
        if profile.followers_count is None:
            omitted += 1
            logger.warning(
                "metric sync followers_omitted org_id=%s user_id=%s previous=%s reason=omitted",
                org.id,
                user.id,
                org.follower_count,
            )
            continue
        org.follower_count = profile.followers_count
        refreshed += 1

    await db.flush()
    return {
        "followers_refreshed": refreshed,
        "followers_omitted": omitted,
        "followers_failed": failed,
    }


async def sync_metrics(db: AsyncSession, ig: InstagramClient) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    window_start = now - _WINDOW

    orgs = await _eligible_orgs(db, now)
    discovered = 0
    refreshed = 0
    failed = 0
    skipped_token = 0
    skipped_story = 0
    likes_omitted = 0
    comments_omitted = 0

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
            logger.warning(
                "media list failed for org %s",
                org.id,
                exc_info=False,
            )
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
                    SocialPost.org_id == org.id,
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
            # Stories are out of scope for v1 (24h metrics; no durable refresh).
            # Meta /me/media should not list them; skip if Graph returns STORY anyway.
            if fields.media_product_type == SocialMediaProductType.STORY.value:
                skipped_story += 1
                continue
            # Insert in a savepoint so a concurrent run losing the
            # UNIQUE(org_id, platform, external_id) race skips that post instead of
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
                            # New rows have no prior KPI; omitted Graph keys → 0.
                            likes=fields.like_count if fields.like_count is not None else 0,
                            comments=(
                                fields.comments_count if fields.comments_count is not None else 0
                            ),
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
            omit_likes, omit_comments = _apply_basics(post, fields)
            if omit_likes:
                likes_omitted += 1
            if omit_comments:
                comments_omitted += 1

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

    follower_stats = await _refresh_follower_counts(db, ig, now)

    return {
        "orgs": len(orgs),
        "posts_discovered": discovered,
        "posts_refreshed": refreshed,
        "failures": failed,
        "skipped_token": skipped_token,
        "skipped_story": skipped_story,
        "likes_omitted": likes_omitted,
        "comments_omitted": comments_omitted,
        **follower_stats,
    }
