"""Instagram metric sync (architecture.md §10.1).

Every 8 hours (03:00 / 11:00 / 19:00 UTC). For each org with a live campaign
and a valid long-lived token:

1. **Discovery** — ``GET /me/media`` (paged, capped) finds posts in the 30-day
   window; new ones are inserted (``metrics_updated_at = NULL``).
2. **Refresh** — for every refresh-eligible post (``posted_at >= now - 30d``,
   not a STORY), pull basic fields then insights separately. Basics
   (likes/comments/caption/media URLs) persist even when insights fail. If Graph
   omits ``like_count`` / ``comments_count`` / ``caption`` / ``media_url`` /
   ``thumbnail_url``, prior DB values are carried (not zeroed or wiped);
   present ``0`` / ``""`` still overwrite, and a present-null URL still clears.
   Counters ``likes_omitted`` / ``comments_omitted`` / ``caption_omitted`` /
   ``media_url_omitted`` / ``thumbnail_url_omitted`` land in the job summary.
   ``metrics_updated_at`` is stamped when basics succeed (including after an
   insights failure) so charts can include the post; insight columns update
   only on insights success.
3. **Follower counts** — after media sync, refresh ``organizations.follower_count``
   from Graph ``followers_count`` for **every** non-erased org user with a usable
   token (not only live-stage campaign orgs). Omit/null/fail keep prior values.
   A live-campaign org whose user the candidate query missed is still refreshed
   from the same user row media sync uses. Token, missing-org, and
   candidate-query misses are warned and counted. Summary counters
   ``followers_refreshed`` / ``followers_omitted`` / ``followers_failed`` /
   ``followers_skipped``.

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
import math
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
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
from app.services.insight_units import clamp_reels_skip_rate
from app.services.instagram import InstagramClient, MediaFields, merge_follower_count
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


def _apply_basics(post: SocialPost, fields: MediaFields) -> tuple[bool, bool, bool, bool, bool]:
    """Apply caption/media URLs and engagement when present.

    Returns ``(likes_omitted, comments_omitted, caption_omitted,
    media_url_omitted, thumbnail_url_omitted)`` — omitted Graph keys keep the
    prior DB value (real ``0`` / present ``""`` still overwrite; present-null
    URL still clears).
    """

    caption_omitted = False
    media_url_omitted = False
    thumbnail_url_omitted = False
    if fields.caption is None:
        caption_omitted = True
        logger.warning(
            "metric sync omitted caption org_id=%s post_id=%s external_id=%s previous=%s",
            post.org_id,
            post.id,
            post.external_id,
            post.caption,
        )
    else:
        post.caption = fields.caption
    if fields.media_url_omitted:
        media_url_omitted = True
        logger.warning(
            "metric sync omitted media_url org_id=%s post_id=%s external_id=%s previous=%s",
            post.org_id,
            post.id,
            post.external_id,
            post.media_url,
        )
    else:
        post.media_url = fields.media_url
    if fields.thumbnail_url_omitted:
        thumbnail_url_omitted = True
        logger.warning(
            "metric sync omitted thumbnail_url org_id=%s post_id=%s external_id=%s previous=%s",
            post.org_id,
            post.id,
            post.external_id,
            post.thumbnail_url,
        )
    else:
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
    return (
        likes_omitted,
        comments_omitted,
        caption_omitted,
        media_url_omitted,
        thumbnail_url_omitted,
    )


def _json_safe_skip_rate(raw: object) -> bool:
    """True when ``raw`` can be stored in JSON (finite number, including out of range)."""

    return not isinstance(raw, bool) and isinstance(raw, (int, float)) and math.isfinite(raw)


def _skip_rate_out_of_range(raw: object) -> bool:
    """True when a Graph skip rate is outside 0–100 or is not a finite number."""

    if not _json_safe_skip_rate(raw):
        return True
    number = float(raw)  # type: ignore[arg-type]
    return number < 0 or number > 100


def _apply_insights(post: SocialPost, insights: dict[str, int | float]) -> None:
    stored = dict(insights)
    for col in _INSIGHT_COLUMNS:
        if col in stored:
            setattr(post, col, stored[col])
    if "reels_skip_rate" in stored:
        raw = stored["reels_skip_rate"]
        if _skip_rate_out_of_range(raw):
            # post id + media id + the Graph number. No caption, handle, or token.
            logger.warning(
                "metric sync reels_skip_rate outside 0-100 "
                "post_id=%s external_id=%s reels_skip_rate=%s",
                post.id,
                post.external_id,
                raw,
            )
        # Column is what the UI reads. insights_raw keeps Graph's number.
        # NaN and Inf are not JSON, so they are only in the warning above.
        post.reels_skip_rate = clamp_reels_skip_rate(raw)
        if not _json_safe_skip_rate(raw):
            stored.pop("reels_skip_rate")
    post.insights_raw = stored


async def _eligible_orgs(db: AsyncSession, now: datetime) -> list[Organization]:
    """Orgs with at least one accepted application on a live-stage drop.

    Erased accounts are excluded. Their posts stay linked with last-known
    numbers and ``metrics_frozen_at`` set, and this job must not call
    Instagram for them (PRODUCT §3.1.2).
    """
    org_ids = (
        select(DropApplication.org_id)
        .join(Drop, Drop.id == DropApplication.drop_id)
        .join(Organization, Organization.id == DropApplication.org_id)
        .join(User, User.id == Organization.user_id)
        .where(
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            Drop.brand_tracker_stage.in_(_LIVE_STAGES),
            Drop.hidden_at.is_(None),
            User.status != OrgUserStatus.ERASED.value,
        )
        .distinct()
    )
    return list(await db.scalars(select(Organization).where(Organization.id.in_(org_ids))))


def _resolve_token(user: User | None, now: datetime) -> tuple[str | None, str]:
    """Return ``(plaintext, "ok")`` or ``(None, reason)``.

    Reasons: ``missing_user``, ``missing_token``, ``expired``,
    ``undecryptable``, ``decrypt_error``. Undecryptable ciphertext is cleared.
    Callers that skip must log the reason — this function does not.
    """

    if user is None:
        return None, "missing_user"
    if not user.instagram_access_token:
        return None, "missing_token"
    exp = user.instagram_token_expires_at
    if exp is not None:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp <= now:
            return None, "expired"  # on-login flow flags for re-auth
    try:
        return decrypt_token(user.instagram_access_token), "ok"
    except TokenDecryptionError:
        clear_unusable_instagram_token(user)
        return None, "undecryptable"
    except Exception:  # noqa: BLE001
        return None, "decrypt_error"


def _token_for(user: User | None, now: datetime) -> str | None:
    token, _reason = _resolve_token(user, now)
    return token


def _log_follower_skip(
    *,
    org: Organization | None,
    user_id: Any,
    reason: str,
) -> None:
    logger.warning(
        "metric sync followers_skipped org_id=%s user_id=%s previous=%s reason=%s",
        org.id if org is not None else None,
        user_id,
        org.follower_count if org is not None else None,
        reason,
    )


async def _store_follower_count(
    org: Organization, user: User, token: str, ig: InstagramClient
) -> str:
    """Write a present Graph count. Return ``refreshed``, ``omitted``, or ``failed``.

    Omit and fetch errors keep the stored count (never overwrite with null).
    """

    try:
        profile = await ig.fetch_profile(token)
    except Exception:  # noqa: BLE001
        logger.warning(
            "metric sync followers_failed org_id=%s user_id=%s previous=%s reason=fetch_error",
            org.id,
            user.id,
            org.follower_count,
        )
        return "failed"
    if profile.followers_count is None:
        logger.warning(
            "metric sync followers_omitted org_id=%s user_id=%s previous=%s reason=%s",
            org.id,
            user.id,
            org.follower_count,
            "invalid" if profile.followers_count_invalid else "omitted",
        )
        return "omitted"
    org.follower_count = merge_follower_count(org.follower_count, profile.followers_count)
    return "refreshed"


async def _refresh_follower_counts(
    db: AsyncSession,
    ig: InstagramClient,
    now: datetime,
    media_orgs: list[Organization] | None = None,
) -> dict[str, int]:
    """Refresh ``organizations.follower_count`` from Graph for tokened orgs.

    Walks all non-erased org users with a non-null token (not only live-stage
    campaign eligibility), then any media-sync org whose user that query
    missed. Media sync never filters on ``portal_role``; this second pass uses
    the same ``organizations.user_id`` load so a post refresh cannot finish
    with a silent follower skip. Omit/null/fail keep the prior DB value.
    Erased accounts are not sent to Graph.
    """

    refreshed = 0
    omitted = 0
    failed = 0
    skipped = 0
    attempted: set[object] = set()

    def _tally(outcome: str) -> None:
        nonlocal refreshed, omitted, failed, skipped
        if outcome == "refreshed":
            refreshed += 1
        elif outcome == "omitted":
            omitted += 1
        elif outcome == "failed":
            failed += 1
        else:
            skipped += 1

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
        attempted.add(user.id)
        org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
        token, reason = _resolve_token(user, now)
        if token is None or org is None:
            _log_follower_skip(
                org=org,
                user_id=user.id,
                reason=reason if token is None else "no_org",
            )
            _tally("skipped")
            continue
        _tally(await _store_follower_count(org, user, token, ig))

    for org in media_orgs or []:
        owner = await db.get(User, org.user_id)
        if owner is None:
            _log_follower_skip(org=org, user_id=org.user_id, reason="missing_user")
            _tally("skipped")
            continue
        if owner.id in attempted or owner.status == OrgUserStatus.ERASED.value:
            continue
        token, reason = _resolve_token(owner, now)
        if token is None:
            # No ciphertext at all: media sync also skips quietly (no posts moved).
            if reason == "missing_token":
                continue
            _log_follower_skip(org=org, user_id=owner.id, reason=reason)
            _tally("skipped")
            continue
        # Media sync never filters portal_role. A usable token with any other
        # role is absent from the candidate query above and would otherwise
        # finish at followers_refreshed 0 with no warning.
        logger.warning(
            "metric sync followers candidate missed org_id=%s user_id=%s portal_role=%s status=%s",
            org.id,
            owner.id,
            owner.portal_role,
            owner.status,
        )
        _tally(await _store_follower_count(org, owner, token, ig))

    await db.flush()
    return {
        "followers_refreshed": refreshed,
        "followers_omitted": omitted,
        "followers_failed": failed,
        "followers_skipped": skipped,
    }


async def sync_metrics_for_orgs(
    db: AsyncSession,
    ig: InstagramClient,
    orgs: list[Organization],
) -> dict[str, Any]:
    """Discover + refresh media for these orgs. Does **not** walk followers."""

    now = datetime.now(timezone.utc)
    window_start = now - _WINDOW
    discovered = 0
    refreshed = 0
    failed = 0
    skipped_token = 0
    skipped_story = 0
    likes_omitted = 0
    comments_omitted = 0
    caption_omitted = 0
    media_url_omitted = 0
    thumbnail_url_omitted = 0

    for org in orgs:
        user = await db.get(User, org.user_id)
        if user is not None and user.status == OrgUserStatus.ERASED.value:
            continue
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
            # Insert in a savepoint so one bad row (unique race, or a value
            # Postgres rejects) skips that post instead of aborting the sync.
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
                            # New rows have no prior caption; omitted Graph key → "".
                            caption=fields.caption if fields.caption is not None else "",
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
            except SQLAlchemyError:
                logger.warning(
                    "metric sync skipped post insert org_id=%s external_id=%s",
                    org.id,
                    ref.id,
                    exc_info=False,
                )
                failed += 1
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
                    SocialPost.metrics_frozen_at.is_(None),
                    SocialPost.external_id.notlike("frozen-%"),
                    SocialPost.external_id.notlike("erased-%"),
                )
            )
        )
        for post in posts:
            is_reel = post.media_product_type == SocialMediaProductType.REELS.value
            try:
                fields = await ig.fetch_media(token, post.external_id)
            except Exception:  # noqa: BLE001
                logger.warning(
                    "metric sync media fetch failed org_id=%s post_id=%s external_id=%s",
                    org.id,
                    post.id,
                    post.external_id,
                )
                failed += 1
                continue
            omit_likes, omit_comments, omit_caption, omit_media_url, omit_thumb = _apply_basics(
                post, fields
            )
            if omit_likes:
                likes_omitted += 1
            if omit_comments:
                comments_omitted += 1
            if omit_caption:
                caption_omitted += 1
            if omit_media_url:
                media_url_omitted += 1
            if omit_thumb:
                thumbnail_url_omitted += 1

            try:
                insights = await ig.fetch_media_insights(token, post.external_id, is_reel=is_reel)
            except Exception:  # noqa: BLE001
                # Basics kept; prior insight columns untouched; stamp so charts
                # include the post (LOCKED cluster approach).
                logger.warning(
                    "metric sync insights failed org_id=%s post_id=%s external_id=%s",
                    org.id,
                    post.id,
                    post.external_id,
                )
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
        "skipped_story": skipped_story,
        "likes_omitted": likes_omitted,
        "comments_omitted": comments_omitted,
        "caption_omitted": caption_omitted,
        "media_url_omitted": media_url_omitted,
        "thumbnail_url_omitted": thumbnail_url_omitted,
    }


async def sync_metrics(db: AsyncSession, ig: InstagramClient) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    orgs = await _eligible_orgs(db, now)
    media = await sync_metrics_for_orgs(db, ig, orgs)
    follower_stats = await _refresh_follower_counts(db, ig, now, orgs)
    return {**media, **follower_stats}
