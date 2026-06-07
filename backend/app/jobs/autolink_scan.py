"""Post auto-link suggestion scan (architecture.md §10.4).

For every accepted application whose drop is live (awaiting_products /
drop_active / drop_finished) and whose brand has an Instagram handle, scan the
org's recent posts for a mention of the brand handle (or the campaign hashtag)
and write a ``post_campaign_suggestions`` row the org can one-tap confirm
(§7.4.1). Never auto-confirms — the org must accept.

Idempotent via ``UNIQUE(post_id, application_id)`` (a re-insert is skipped), so
this is safe to run on a cron. (An on-demand re-scan endpoint — e.g. when an org
opens a campaign — could reuse this logic but is not currently wired.)
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
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

# Drops whose campaign is "live enough" that posts matter.
_LIVE_STAGES = (
    BrandTrackerStage.AWAITING_PRODUCTS.value,
    BrandTrackerStage.DROP_ACTIVE.value,
    BrandTrackerStage.DROP_FINISHED.value,
)
# We only auto-suggest FEED + REELS (not STORY/AD).
_SUGGESTABLE = (SocialMediaProductType.FEED.value, SocialMediaProductType.REELS.value)
_PRE_WINDOW = timedelta(days=7)  # teaser posts just before the drop opens
_EVIDENCE_CONTEXT = 20


def _evidence(caption: str, start: int, end: int) -> str:
    lo = max(0, start - _EVIDENCE_CONTEXT)
    hi = min(len(caption), end + _EVIDENCE_CONTEXT)
    snippet = caption[lo:hi].strip()
    return f"…{snippet}…" if (lo > 0 or hi < len(caption)) else snippet


def _match(caption: str, handle: str, hashtag: str | None) -> tuple[str, str] | None:
    """Return (match_reason, evidence) if the caption mentions the handle/hashtag."""
    # `(?<!\w)@handle\b` — handle not preceded by a word char (so emails like
    # "x@nike" don't match) and ending on a boundary (so "@nike" != "@nikeshoes").
    handle_re = re.compile(rf"(?<!\w)@{re.escape(handle)}\b", re.IGNORECASE)
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
                            drop_id=drop.id,
                            match_reason=reason,
                            match_evidence=evidence,
                        )
                    )
            except IntegrityError:
                continue
            created += 1

    await db.flush()
    return {
        "applications_scanned": len(rows),
        "posts_scanned": scanned,
        "suggestions_created": created,
    }
