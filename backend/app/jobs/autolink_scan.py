"""Post auto-link suggestion scan (architecture.md §10.4).

For every accepted application whose drop is live (awaiting_products /
drop_active) and whose brand has an Instagram handle, scan the org's recent
posts for a mention of the brand handle (or the campaign hashtag) and write a
``post_campaign_suggestions`` row the org can one-tap confirm (§7.4.1). Never
auto-confirms — the org must accept. ``drop_finished`` is excluded: the org UI
is read-only there, so new pending suggestions would sit forever.

Idempotent via ``UNIQUE(post_id, application_id)`` (a re-insert is skipped), so
this is safe to run on a cron. (An on-demand re-scan endpoint — e.g. when an org
opens a campaign — could reuse this logic but is not currently wired.)

The scan also heals suggestions that can no longer be accepted: the org would
get 409/410 on them forever, so they're dismissed instead of sitting pending.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    SocialMediaProductType,
    SuggestionMatchReason,
)
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost

# Drops whose campaign is live enough that new suggestions are actionable.
# drop_finished is intentionally omitted — org finished detail is read-only.
_LIVE_STAGES = (
    BrandTrackerStage.AWAITING_PRODUCTS.value,
    BrandTrackerStage.DROP_ACTIVE.value,
)
# We only auto-suggest FEED + REELS (not STORY/AD).
_SUGGESTABLE = (SocialMediaProductType.FEED.value, SocialMediaProductType.REELS.value)
_PRE_WINDOW = timedelta(days=7)  # teaser posts just before the drop opens
_EVIDENCE_CONTEXT = 20
# Trailing chars that mean the match is a longer handle / URL path, not a
# bare @handle mention. ``\b`` is wrong here because ``.`` / ``/`` are
# non-word chars, so ``@nike`` would otherwise hit inside ``@nike.official``
# and ``instagram.com/@nike/...``. Underscore is included so ``@nike`` stays
# distinct from ``@nike_official`` (same as the old ``\b`` behavior).
_HANDLE_TRAIL = r"A-Za-z0-9._/"


def _evidence(caption: str, start: int, end: int) -> str:
    lo = max(0, start - _EVIDENCE_CONTEXT)
    hi = min(len(caption), end + _EVIDENCE_CONTEXT)
    snippet = caption[lo:hi].strip()
    return f"…{snippet}…" if (lo > 0 or hi < len(caption)) else snippet


def _match(caption: str, handle: str, hashtag: str | None) -> tuple[str, str] | None:
    """Return (match_reason, evidence) if the caption mentions the handle/hashtag."""
    # `(?<!\w)@handle(?![A-Za-z0-9._/])` — handle not preceded by a word char
    # (so emails like "x@nike" don't match) and not continued by handle/path
    # chars (so "@nike" != "@nike.official" / URL ``/@nike/...``).
    handle_re = re.compile(
        rf"(?<!\w)@{re.escape(handle)}(?![{_HANDLE_TRAIL}])",
        re.IGNORECASE,
    )
    handle_m = handle_re.search(caption)
    hashtag_m = None
    if hashtag:
        hashtag_re = re.compile(rf"#{re.escape(hashtag)}\b", re.IGNORECASE)
        hashtag_m = hashtag_re.search(caption)

    if handle_m and hashtag_m:
        return SuggestionMatchReason.BOTH.value, _evidence(caption, *handle_m.span())
    if handle_m:
        return SuggestionMatchReason.BRAND_HANDLE_CAPTION.value, _evidence(
            caption, *handle_m.span()
        )
    if hashtag_m:
        return SuggestionMatchReason.CAMPAIGN_HASHTAG.value, _evidence(caption, *hashtag_m.span())
    return None


async def _heal_dangling(db: AsyncSession, now: datetime) -> int:
    """Dismiss pending suggestions that could only ever 409 or 410.

    Cross-campaign only: a pending suggestion whose post is already linked to
    *this* campaign is accept's reconcile path (confirm), not a terminal 409.
    Also retires rows whose post row has vanished.
    """

    linked_elsewhere = (
        select(PostCampaignLink.id)
        .where(
            PostCampaignLink.post_id == PostCampaignSuggestion.post_id,
            PostCampaignLink.application_id != PostCampaignSuggestion.application_id,
        )
        .exists()
    )
    post_missing = ~(
        select(SocialPost.id).where(SocialPost.id == PostCampaignSuggestion.post_id).exists()
    )
    result = await db.execute(
        update(PostCampaignSuggestion)
        .where(
            PostCampaignSuggestion.confirmed_at.is_(None),
            PostCampaignSuggestion.dismissed_at.is_(None),
            or_(linked_elsewhere, post_missing),
        )
        .values(dismissed_at=now)
        .execution_options(synchronize_session=False)
    )
    return getattr(result, "rowcount", 0) or 0


async def scan_autolink(db: AsyncSession) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    # Accepted applications on live drops whose brand has a handle to match on.
    rows = list(
        await db.execute(
            select(DropApplication, Drop, Brand)
            .join(Drop, Drop.id == DropApplication.drop_id)
            .join(Brand, Brand.id == Drop.brand_id)
            .where(
                DropApplication.decision == ApplicationDecision.ACCEPTED.value,
                Drop.brand_tracker_stage.in_(_LIVE_STAGES),
                Brand.instagram_handle.isnot(None),
            )
        )
    )

    created = 0
    scanned = 0
    for application, drop, brand in rows:
        handle = (brand.instagram_handle or "").lstrip("@")
        if not handle:
            continue
        hashtag = (drop.campaign_hashtag or "").lstrip("#") or None

        window_start = drop.apply_open_at - _PRE_WINDOW
        posts = list(
            await db.scalars(
                select(SocialPost).where(
                    SocialPost.org_id == application.org_id,
                    SocialPost.posted_at >= window_start,
                    SocialPost.posted_at <= now,
                    SocialPost.media_product_type.in_(_SUGGESTABLE),
                )
            )
        )

        for post in posts:
            scanned += 1
            # One-post-one-campaign: skip if already linked anywhere.
            if await db.scalar(
                select(func.count())
                .select_from(PostCampaignLink)
                .where(PostCampaignLink.post_id == post.id)
            ):
                continue
            # Idempotent: skip if a suggestion already exists for this pair.
            if await db.scalar(
                select(func.count())
                .select_from(PostCampaignSuggestion)
                .where(
                    PostCampaignSuggestion.post_id == post.id,
                    PostCampaignSuggestion.application_id == application.id,
                )
            ):
                continue

            hit = _match(post.caption, handle, hashtag)
            if hit is None:
                continue
            reason, evidence = hit
            # Savepoint so a concurrent run losing the
            # UNIQUE(post_id, application_id) race skips this pair instead of
            # aborting the whole scan's transaction.
            try:
                async with db.begin_nested():
                    db.add(
                        PostCampaignSuggestion(
                            post_id=post.id,
                            application_id=application.id,
                            match_reason=reason,
                            match_evidence=evidence,
                        )
                    )
            except IntegrityError:
                continue
            created += 1

    healed = await _heal_dangling(db, now)

    await db.flush()
    return {
        "applications_scanned": len(rows),
        "posts_scanned": scanned,
        "suggestions_created": created,
        "suggestions_healed": healed,
    }
