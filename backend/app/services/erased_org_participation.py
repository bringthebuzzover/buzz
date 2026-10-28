"""Freeze an erased org's campaign metrics and strip Instagram identifiers.

Brand totals are live sums over linked posts. Erase keeps the accepted seat,
the link, and the last likes, comments, reach, views, saved, and shares.
Profile-adjacent counts and watch time are cleared. The statements here are
what the data migration runs for orgs already erased. Erase itself updates the
loaded rows in the session (same fields) so a later flush cannot write the
old permalinks or insight columns back.

Kept on the post: likes, comments, reach, views, saved, shares, ``posted_at``,
``media_type``, ``media_product_type``, ``platform``. Cleared: media id,
permalink, media URLs, thumbnail, caption, raw insights, reposts, total
interactions, profile visits, profile activity, follows, reel watch time, and
skip rate. ``follower_count`` and ``university`` are cleared. Campus totals
skip a blank university.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import DropApplication
from app.models.enums import OrgUserStatus, PortalRole
from app.models.notify_me import NotifyMe
from app.models.org_apply_prefill import OrgApplyPrefill
from app.models.org_connect_token import OrgConnectToken
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.services.instagram import canonical_instagram_handle

TOMBSTONE_ORG_NAME = "Deleted organization"

# Insight columns that are not part of the retained snapshot.
_CLEARED_INSIGHTS = (
    "reposts",
    "total_interactions",
    "profile_visits",
    "profile_activity",
    "follows",
    "ig_reels_avg_watch_time",
    "ig_reels_video_view_total_time",
    "reels_skip_rate",
)


def frozen_external_id(post_id: UUID) -> str:
    """Non-Graph id. Not an Instagram media id."""

    return f"frozen-{post_id}"


def post_metrics_are_frozen(post: SocialPost) -> bool:
    """True when sync, autolink, and manual link must leave this row alone."""

    if post.metrics_frozen_at is not None:
        return True
    external_id = post.external_id or ""
    return external_id.startswith("frozen-") or external_id.startswith("erased-")


def apply_frozen_post_fields(post: SocialPost, frozen_at: datetime) -> None:
    """Stamp and strip one post. Keeps the first ``metrics_frozen_at``."""

    if post.metrics_frozen_at is None:
        post.metrics_frozen_at = frozen_at
    post.external_id = frozen_external_id(post.id)
    post.url = ""
    post.caption = ""
    post.media_url = None
    post.thumbnail_url = None
    post.insights_raw = None
    for column in _CLEARED_INSIGHTS:
        setattr(post, column, None)


def freeze_statements() -> list[str]:
    """Idempotent SQL for every erased org. Does not delete seats or posts."""

    pred = "u.portal_role = 'org' AND u.status = 'erased'"
    orgs = "SELECT o.id FROM organizations o " "JOIN users u ON u.id = o.user_id " f"WHERE {pred}"
    users = f"SELECT u.id FROM users u WHERE {pred}"
    apps = f"SELECT a.id FROM drop_applications a WHERE a.org_id IN ({orgs})"
    posts = f"SELECT p.id FROM social_posts p WHERE p.org_id IN ({orgs})"
    return [
        (
            "UPDATE social_posts AS p SET "
            "metrics_frozen_at = COALESCE(p.metrics_frozen_at, now()), "
            "external_id = 'frozen-' || p.id::text, "
            "url = '', "
            "caption = '', "
            "media_url = NULL, "
            "thumbnail_url = NULL, "
            "insights_raw = NULL, "
            "reposts = NULL, "
            "total_interactions = NULL, "
            "profile_visits = NULL, "
            "profile_activity = NULL, "
            "follows = NULL, "
            "ig_reels_avg_watch_time = NULL, "
            "ig_reels_video_view_total_time = NULL, "
            "reels_skip_rate = NULL "
            f"WHERE p.org_id IN ({orgs})"
        ),
        (
            "UPDATE organizations AS o SET "
            f"org_name = '{TOMBSTONE_ORG_NAME}', "
            "approved_at = NULL, "
            "university = '', "
            "follower_count = NULL, "
            "tiktok_handle = NULL, "
            "member_count = NULL, "
            "category = NULL, "
            "city = NULL, "
            "state = NULL, "
            "contact_name = NULL, "
            "delivery_address = NULL, "
            "shipping_line1 = NULL, "
            "shipping_line2 = NULL, "
            "shipping_city = NULL, "
            "shipping_state = NULL, "
            "shipping_postal_code = NULL, "
            "claimed_instagram_username = NULL, "
            "instagram_handle_confirmed = false, "
            "ig_bind_graph_username = NULL, "
            "ig_bind_mismatched_at = NULL, "
            "ig_bind_mismatch_acked_at = NULL "
            "FROM users u "
            f"WHERE u.id = o.user_id AND {pred}"
        ),
        (
            "UPDATE users AS u SET "
            "instagram_user_id = NULL, "
            "instagram_token_user_id = NULL, "
            "instagram_username = NULL, "
            "instagram_granted_permissions = NULL, "
            "instagram_access_token = NULL, "
            "instagram_token_issued_at = NULL, "
            "instagram_token_expires_at = NULL, "
            "instagram_token_refreshed_at = NULL, "
            "edu_email = NULL, "
            "pending_edu_email = NULL, "
            "email_verified_at = NULL, "
            "password_hash = NULL "
            f"WHERE {pred}"
        ),
        (
            "UPDATE drop_applications SET pitch = NULL "
            f"WHERE org_id IN ({orgs}) AND pitch IS NOT NULL"
        ),
        (
            "UPDATE drop_apply_intents SET pitch = NULL "
            f"WHERE org_id IN ({orgs}) AND pitch IS NOT NULL"
        ),
        (
            "UPDATE drop_apply_intents SET status = 'expired' "
            f"WHERE org_id IN ({orgs}) AND status = 'open'"
        ),
        (
            "DELETE FROM post_campaign_suggestions "
            f"WHERE application_id IN ({apps}) OR post_id IN ({posts})"
        ),
        f"DELETE FROM notify_me WHERE org_id IN ({orgs})",
        f"DELETE FROM org_connect_tokens WHERE user_id IN ({users}) OR org_id IN ({orgs})",
        ("DELETE FROM org_ig_change_requests " f"WHERE user_id IN ({users}) OR org_id IN ({orgs})"),
        f"DELETE FROM org_apply_prefills WHERE used_by_user_id IN ({users})",
        f"DELETE FROM email_verification_tokens WHERE user_id IN ({users})",
        f"DELETE FROM password_reset_tokens WHERE user_id IN ({users})",
    ]


async def _target_org_ids(db: AsyncSession, org_id: UUID | None) -> set[UUID]:
    if org_id is not None:
        return {org_id}
    rows = await db.scalars(
        select(Organization.id)
        .join(User, User.id == Organization.user_id)
        .where(
            User.portal_role == PortalRole.ORG.value,
            User.status == OrgUserStatus.ERASED.value,
        )
    )
    return set(rows)


async def freeze_org_campaign_metrics(
    db: AsyncSession,
    *,
    org_id: UUID | None = None,
    now: datetime | None = None,
) -> None:
    """Stamp and strip posts for one org, or every already-erased org.

    Keeps the first ``metrics_frozen_at``. Safe to run twice. Does not delete
    seats, links, or the retained counts.
    """

    org_ids = await _target_org_ids(db, org_id)
    if not org_ids:
        return
    frozen_at = now or datetime.now(timezone.utc)
    posts = list(await db.scalars(select(SocialPost).where(SocialPost.org_id.in_(org_ids))))
    post_ids = [post.id for post in posts]
    for post in posts:
        apply_frozen_post_fields(post, frozen_at)

    orgs = list(await db.scalars(select(Organization).where(Organization.id.in_(org_ids))))
    for org in orgs:
        org.follower_count = None
        org.university = ""

    await db.execute(
        update(DropApplication).where(DropApplication.org_id.in_(org_ids)).values(pitch=None)
    )
    sug_filters = [
        PostCampaignSuggestion.application_id.in_(
            select(DropApplication.id).where(DropApplication.org_id.in_(org_ids))
        )
    ]
    if post_ids:
        sug_filters.append(PostCampaignSuggestion.post_id.in_(post_ids))
    await db.execute(delete(PostCampaignSuggestion).where(or_(*sug_filters)))
    await db.execute(delete(NotifyMe).where(NotifyMe.org_id.in_(org_ids)))
    await db.flush()


async def purge_erased_identity_rows(
    db: AsyncSession,
    *,
    user: User,
    org: Organization | None,
) -> None:
    """Delete rows that still name this org's email, handle, or connect secret.

    Call before clearing ``user.edu_email`` and ``user.instagram_username`` so
    unlinked apply drafts that stored those values are included.
    """

    emails = [value.strip() for value in (user.edu_email, user.pending_edu_email) if value]
    emails = [value for value in emails if value]
    handles = {
        canonical_instagram_handle(user.instagram_username),
        canonical_instagram_handle(org.claimed_instagram_username) if org is not None else "",
    }
    handles.discard("")
    handle_keys = sorted({handle.casefold() for handle in handles})

    await db.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    )
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))

    connect_filters = [OrgConnectToken.user_id == user.id]
    change_filters = [OrgIgChangeRequest.user_id == user.id]
    if org is not None:
        connect_filters.append(OrgConnectToken.org_id == org.id)
        change_filters.append(OrgIgChangeRequest.org_id == org.id)
    await db.execute(delete(OrgConnectToken).where(or_(*connect_filters)))
    await db.execute(delete(OrgIgChangeRequest).where(or_(*change_filters)))

    prefill_filters = [OrgApplyPrefill.used_by_user_id == user.id]
    if emails:
        lowered = [email.casefold() for email in emails]
        prefill_filters.append(func.lower(OrgApplyPrefill.edu_email).in_(lowered))
        prefill_filters.append(func.lower(OrgApplyPrefill.invite_email).in_(lowered))
    if handle_keys:
        prefill_filters.append(func.lower(OrgApplyPrefill.instagram_handle).in_(handle_keys))
    await db.execute(delete(OrgApplyPrefill).where(or_(*prefill_filters)))
