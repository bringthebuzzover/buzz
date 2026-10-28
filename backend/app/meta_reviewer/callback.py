"""Bind any Business/Creator Instagram account to the seeded reviewer org.

Reuses the Instagram code exchange and the same credential write as Connect.
Normal ``/login`` never calls this. The OAuth ``state`` must carry
``reviewer: true`` and ``bind`` equal to the reviewer user id.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.jobs.autolink_scan import scan_autolink
from app.jobs.metric_sync import sync_metrics_for_orgs
from app.meta_reviewer.gate import REVIEWER_ORG_NAME, require_reviewer_access
from app.meta_reviewer.seed import _clear_org_posts, load_ready_reviewer, reviewer_drop_id
from app.models.user import User
from app.services.auth import _apply_callback_follower_count, _apply_ig_credentials
from app.services.instagram import (
    ALLOWED_ACCOUNT_TYPES,
    InstagramClient,
    canonical_instagram_handle,
)
from app.services.org_apply import assert_handle_available, clear_ig_bind_mismatch

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _other_instagram_owner(
    db: AsyncSession,
    *,
    profile_id: str,
    token_user_id: str,
    reviewer_id: uuid.UUID,
) -> User | None:
    found: User | None = await db.scalar(
        select(User).where(
            User.id != reviewer_id,
            or_(
                User.instagram_user_id == profile_id,
                User.instagram_token_user_id == token_user_id,
                User.instagram_user_id == token_user_id,
                User.instagram_token_user_id == profile_id,
            ),
        )
    )
    return found


async def complete_reviewer_instagram_callback(
    db: AsyncSession,
    ig: InstagramClient,
    code: str,
    *,
    bind_user_id: uuid.UUID | None,
) -> User:
    """Exchange ``code`` and bind it to the reviewer org only.

    Flag off raises 404 before any Instagram call. A bind id that is not the
    reviewer user raises 404 before any Instagram call. A Graph id or handle
    already owned by another org is rejected and left untouched.
    """

    require_reviewer_access()
    user, org = await load_ready_reviewer(db)
    if bind_user_id != user.id or org.org_name != REVIEWER_ORG_NAME:
        raise BuzzAPIException(errors.NOT_FOUND, "Not found.", status_code=404)

    short = await ig.exchange_code(code)
    long = await ig.exchange_for_long_lived(short.access_token)
    profile = await ig.fetch_profile(long.access_token)
    account_type = profile.account_type.upper()
    if account_type not in ALLOWED_ACCOUNT_TYPES:
        raise BuzzAPIException(
            code=errors.INSTAGRAM_PERSONAL_ACCOUNT,
            message=(
                "Your Instagram account must be a Business or Creator account. "
                "Convert it in the Instagram app, then try again."
            ),
            status_code=400,
        )

    owner = await _other_instagram_owner(
        db,
        profile_id=profile.id,
        token_user_id=short.user_id,
        reviewer_id=user.id,
    )
    if owner is not None:
        raise BuzzAPIException(
            errors.INSTAGRAM_HANDLE_TAKEN,
            "This Instagram account is already linked to another Buzz user.",
            status_code=409,
        )

    graph_handle = canonical_instagram_handle(getattr(profile, "username", None) or "")
    if not graph_handle:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Instagram did not return a username.",
            status_code=400,
        )
    await assert_handle_available(db, graph_handle, exclude_user_id=user.id)

    now = _now()
    switched = bool(user.instagram_user_id) and user.instagram_user_id != profile.id
    if switched:
        # Free the previous handle and drop that account's posts before the new bind.
        user.instagram_user_id = None
        user.instagram_token_user_id = None
        user.instagram_username = None
        await db.flush()
        await _clear_org_posts(db, org.id)

    _apply_ig_credentials(
        user,
        profile,
        short.user_id,
        long.access_token,
        now,
        now + timedelta(seconds=long.expires_in),
        short.permissions,
    )
    user.last_login_at = now
    org.instagram_handle_confirmed = True
    org.claimed_instagram_username = graph_handle
    clear_ig_bind_mismatch(org)
    _apply_callback_follower_count(org, profile)

    try:
        await db.flush()
    except IntegrityError as exc:
        detail = str(exc.orig).lower()
        if "instagram_username" in detail or "instagram_user_id" in detail:
            raise BuzzAPIException(
                errors.INSTAGRAM_HANDLE_TAKEN,
                "That Instagram account is already claimed by another organization.",
                status_code=409,
            ) from exc
        raise

    try:
        await sync_metrics_for_orgs(db, ig, [org])
    except Exception:
        logger.warning(
            "meta reviewer sync failed user_id=%s org_id=%s",
            user.id,
            org.id,
            exc_info=False,
        )
    else:
        try:
            await scan_autolink(db, drop_id=reviewer_drop_id(), org_id=org.id)
        except BuzzAPIException:
            logger.warning("meta reviewer autolink skipped user_id=%s", user.id)
        except Exception:
            logger.warning(
                "meta reviewer autolink failed user_id=%s org_id=%s",
                user.id,
                org.id,
                exc_info=False,
            )

    logger.info("meta reviewer instagram bound user_id=%s rebind=%s", user.id, switched)
    return user
