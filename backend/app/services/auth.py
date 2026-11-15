"""Auth / onboarding orchestration (buzz-ops engineering/architecture.md §3.4).

Pure service functions — no FastAPI types — that the route layer calls.
Instagram OAuth creates pending profile users, refreshes returning users, and
binds existing applications through the legacy Connect flow.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import UserResponse
from app.security import jwt
from app.security.session import bump_token_version, commit_revocation
from app.security.token_crypto import encrypt_token
from app.services.drop_apply_intents import promote_drop_apply_intents
from app.services.instagram import (
    ALLOWED_ACCOUNT_TYPES,
    InstagramClient,
    canonical_instagram_handle,
    merge_follower_count,
    require_instagram_handle,
    storable_follower_count,
)
from app.services.instagram_token import clear_unusable_instagram_token
from app.services.org_apply import assert_handle_available, flag_ig_bind_mismatch
from app.services.org_connect import org_owes_instagram_reconnect
from app.timeutils import utcnow

logger = logging.getLogger(__name__)


async def handle_instagram_callback(
    db: AsyncSession,
    ig: InstagramClient,
    code: str,
    *,
    bind_user_id: uuid.UUID | None = None,
) -> User:
    """OAuth handshake: bind, refresh, or create a pending org identity.

    * ``bind_user_id`` set (Connect flow) → reconnect the approved switch.
    * Graph id already on a user → refresh tokens (returning login).
    * Unknown Graph id, no bind → org user awaiting their initial profile.

    When an org row exists and Graph sent ``followers_count``, it is stored
    on that org. A missing or failed count leaves the stored value alone.
    """

    short = await ig.exchange_code(code)
    long = await ig.exchange_for_long_lived(short.access_token)
    profile = await ig.fetch_profile(long.access_token)

    account_type = profile.account_type.upper()
    if account_type not in ALLOWED_ACCOUNT_TYPES:
        logger.warning(
            "instagram callback rejected account_type=%s ig_user_id=%s",
            account_type,
            profile.id,
        )
        raise BuzzAPIException(
            code=errors.INSTAGRAM_PERSONAL_ACCOUNT,
            message=(
                "Your Instagram account must be a Business or Creator account. "
                "Convert it in the Instagram app, then try again."
            ),
            status_code=400,
        )

    now = utcnow()
    expires_at = now + timedelta(seconds=long.expires_in)
    matches = (
        await db.scalars(
            select(User).where(
                or_(
                    User.instagram_user_id == profile.id,
                    User.instagram_token_user_id == short.user_id,
                    User.instagram_user_id == short.user_id,
                    User.instagram_token_user_id == profile.id,
                )
            )
        )
    ).all()
    if len(matches) > 1:
        raise BuzzAPIException(
            errors.INSTAGRAM_HANDLE_TAKEN,
            "This Instagram identity is linked to conflicting accounts. Contact Buzz.",
            status_code=409,
        )
    existing = matches[0] if matches else None

    if bind_user_id is not None:
        target = await db.get(User, bind_user_id)
        if target is None or target.portal_role != PortalRole.ORG.value:
            raise BuzzAPIException(
                errors.NOT_FOUND,
                "Organization account not found.",
                status_code=404,
            )
        if not await org_owes_instagram_reconnect(db, target):
            raise BuzzAPIException(
                errors.INVALID_ONBOARDING_STATE,
                "This account is not waiting to connect Instagram.",
                status_code=400,
            )
        if existing is not None and existing.id != target.id:
            raise BuzzAPIException(
                errors.INSTAGRAM_HANDLE_TAKEN,
                "This Instagram account is already linked to another Buzz user.",
                status_code=409,
            )
        user = target
    elif existing is None:
        require_instagram_handle(profile.username)
        user = User(
            id=uuid.uuid4(),
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.PENDING_ORG_PROFILE.value,
        )
    else:
        user = existing

    if user.status == OrgUserStatus.ERASED.value:
        # Do not write Graph ids, the handle, or a token back onto a tombstone.
        raise BuzzAPIException(
            errors.ACCOUNT_DENIED,
            "This account has been deleted.",
            status_code=403,
        )

    graph_handle = canonical_instagram_handle(getattr(profile, "username", None) or "")
    if graph_handle:
        await assert_handle_available(db, graph_handle, exclude_user_id=user.id)

    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This Instagram identity is not linked to an organization.",
            status_code=400,
        )

    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if bind_user_id is not None:
        open_switches = list(
            await db.scalars(
                select(OrgIgChangeRequest).where(
                    OrgIgChangeRequest.user_id == user.id,
                    OrgIgChangeRequest.status == "awaiting_connect",
                    OrgIgChangeRequest.decided_kind == "account_switch",
                )
            )
        )
        # An approved account switch names the handle the org must bind to. Binding
        # any other account would hand the org portal access (it stays ``active``
        # and gains fresh Graph credentials) and close the ticket as done, so the
        # bind is refused: no credentials are written, the ticket stays
        # ``awaiting_connect``, and the org can retry with the approved handle.
        # The attempt is still recorded on the org for admins — the same flag as
        # the advisory Connect mismatch — and committed before raising, because
        # the refusal rolls this request's transaction back.
        #
        # Only tickets that name a real switch target are enforced. A ticket
        # whose ``current_handle`` and ``requested_handle`` are the same handle
        # (see ``_names_switch_target``) carries no admin-approved target: the
        # pending_instagram retirement synthesizes exactly that shape for orgs
        # that were approved under the old apply-first flow and never connected.
        # Those must accept whichever account the org finally binds — enforcing
        # the handle they typed before ever connecting would re-brick the cohort
        # the ticket exists to rescue. Real switches always name two different
        # handles, because ``submit_request`` refuses a no-op switch.
        #
        # Legacy ``bind_user_id`` binds with no open switch skip all of this and
        # behave exactly as before.
        enforced = _switch_target_handles(open_switches)
        if enforced and graph_handle.casefold() not in enforced:
            await _refuse_switch_bind(db, org, graph_handle, enforced, user_id=user.id, now=now)
        closed_switches = [
            row for row in open_switches if _switch_satisfied_by_bind(row, graph_handle)
        ]
    else:
        closed_switches = []

    if bind_user_id is not None and org is not None:
        claimed = canonical_instagram_handle(org.claimed_instagram_username)
        if claimed and graph_handle and claimed.lower() != graph_handle.lower():
            logger.info(
                "instagram bind handle overwrite user_id=%s claimed=%s graph=%s",
                user.id,
                claimed,
                graph_handle,
            )
            flag_ig_bind_mismatch(org, graph_handle, now)

    _apply_ig_credentials(
        user,
        profile,
        short.user_id,
        long.access_token,
        now,
        expires_at,
        short.permissions,
    )
    user.last_login_at = now
    if closed_switches:
        # Close only the tickets this bind actually satisfied, so a leftover row
        # never reports a handle the org did not bind. Empty for a legacy
        # ``bind_user_id`` bind with no open switch, and for a plain login.
        await db.execute(
            update(OrgIgChangeRequest)
            .where(OrgIgChangeRequest.id.in_([row.id for row in closed_switches]))
            .values(status="approved")
        )
    if org is not None:
        org.instagram_handle_confirmed = True
        # Graph-owned. Missing/failed counts must not fail the login.
        _apply_callback_follower_count(org, profile)

    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        detail = str(exc.orig).lower()
        if "instagram_username" in detail or "uq_users_org_instagram_username_lower" in detail:
            raise BuzzAPIException(
                errors.INSTAGRAM_HANDLE_TAKEN,
                "That Instagram handle is already claimed by another organization.",
                status_code=409,
            ) from exc
        if "instagram_user_id" in detail or "instagram_token_user_id" in detail:
            raise BuzzAPIException(
                errors.INSTAGRAM_HANDLE_TAKEN,
                "This Instagram account is already linked. Try logging in again.",
                status_code=409,
            ) from exc
        raise
    await db.refresh(user)
    if bind_user_id is not None:
        await promote_drop_apply_intents(db, user)
    return user


def _names_switch_target(row: OrgIgChangeRequest) -> bool:
    """Whether *row* names an admin-approved switch target.

    A real approved switch names a handle that differs from the org's previous
    one, so ``current_handle`` and ``requested_handle`` differ. Tickets whose two
    handles are identical are placeholders synthesized by the
    ``pending_instagram`` retirement for orgs approved under the retired
    apply-first flow that never connected; they carry no admin-approved target.
    """

    requested = canonical_instagram_handle(row.requested_handle)
    return (
        bool(requested)
        and requested.casefold() != canonical_instagram_handle(row.current_handle).casefold()
    )


def _switch_target_handles(switches: list[OrgIgChangeRequest]) -> set[str]:
    """Casefolded ``requested_handle`` values a switch bind must match.

    Empty when every open ticket is a placeholder (see
    :func:`_names_switch_target`), which is the signal to accept any bound
    account — enforcing the handle such an org typed months before ever
    connecting would re-brick the cohort the ticket exists to rescue.
    """

    return {
        canonical_instagram_handle(row.requested_handle).casefold()
        for row in switches
        if _names_switch_target(row)
    }


def _switch_satisfied_by_bind(row: OrgIgChangeRequest, graph_handle: str) -> bool:
    """Whether *row* is closed by a bind of ``graph_handle``.

    A real switch closes only on its own requested handle. A placeholder ticket
    (see :func:`_names_switch_target`) is closed by whatever the org binds, which
    is the only way such an org can finish reconnecting.
    """

    if not _names_switch_target(row):
        return True
    granted = graph_handle.casefold()
    return bool(granted) and canonical_instagram_handle(row.requested_handle).casefold() == granted


async def _refuse_switch_bind(
    db: AsyncSession,
    org: Organization | None,
    graph_handle: str,
    requested: set[str],
    *,
    user_id: uuid.UUID,
    now: datetime,
) -> None:
    """Reject a bind that does not satisfy the approved switch's handle.

    The org keeps its ``awaiting_connect`` ticket, so the portal stays closed
    (credentials were released at approve) and the org can retry. The org row
    is flagged for admins like any other Connect mismatch: the flag is written
    and committed here because raising rolls the caller's transaction back, and
    the flag must survive that rollback. Never writes Graph credentials.
    """

    logger.warning(
        "instagram switch bind refused user_id=%s graph=%s requested=%s",
        user_id,
        graph_handle or "(missing)",
        ",".join(sorted(requested)),
    )
    if org is not None and graph_handle:
        flag_ig_bind_mismatch(org, graph_handle, now)
        # Durable before the raise: the route rolls this request back.
        await db.commit()
    handles = " or ".join(f"@{handle}" for handle in sorted(requested))
    raise BuzzAPIException(
        errors.INVALID_ONBOARDING_STATE,
        f"This Instagram account does not match the approved switch. Connect {handles} "
        "to finish reconnecting.",
        status_code=400,
    )


def _apply_callback_follower_count(org: Organization, profile: object) -> None:
    """Persist ``followers_count`` from the OAuth ``/me`` already fetched.

    Best-effort: a missing, non-integer, out-of-range, or unreadable count is
    logged and ignored. ``None`` does not clear a count already on the org.
    A boolean is not stored (``False`` must not become a real ``0``).
    """

    try:
        invalid = getattr(profile, "followers_count_invalid", False) is True
        raw = getattr(profile, "followers_count", None)
        # Re-check the value. ``fetch_profile`` already drops unstorable counts,
        # but a stand-in profile can still hand us a bool or an int PostgreSQL
        # will reject — assigning that aborts the login flush.
        parsed = None if invalid else storable_follower_count(raw)
        if parsed is None:
            logger.warning(
                "instagram callback followers_seed_failed org_id=%s user_id=%s reason=%s",
                org.id,
                org.user_id,
                "invalid" if invalid or raw is not None else "omitted",
            )
            return
        org.follower_count = merge_follower_count(org.follower_count, parsed)
    except Exception:  # noqa: BLE001 — count failures must not break login
        logger.warning(
            "instagram callback followers_seed_failed org_id=%s user_id=%s reason=error",
            org.id,
            org.user_id,
            exc_info=False,
        )


def _apply_ig_credentials(
    user: User,
    profile: object,
    token_user_id: str,
    long_token: str,
    now: datetime,
    expires_at: datetime,
    permissions: tuple[str, ...] | None,
) -> None:
    user.instagram_user_id = profile.id  # type: ignore[attr-defined]
    user.instagram_token_user_id = token_user_id
    user.instagram_username = profile.username  # type: ignore[attr-defined]
    user.instagram_access_token = encrypt_token(long_token)
    user.instagram_token_issued_at = now
    user.instagram_token_expires_at = expires_at
    user.instagram_token_refreshed_at = now
    # Omitted ``permissions`` leaves the previous grant in place.
    if permissions is not None:
        user.instagram_granted_permissions = ",".join(permissions)


async def revoke_instagram_authorization(db: AsyncSession, instagram_user_id: str) -> bool:
    """Handle a Meta deauthorize webhook: drop the token, kill live sessions.

    Returns True when a matching user was revoked, False when unknown.
    """

    user = await db.scalar(
        select(User).where(
            or_(
                User.instagram_user_id == instagram_user_id,
                User.instagram_token_user_id == instagram_user_id,
            )
        )
    )
    if user is None:
        return False
    clear_unusable_instagram_token(user)
    await db.flush()
    await commit_revocation(db)
    return True


async def build_user_response(db: AsyncSession, user: User) -> UserResponse:
    """Serialize a ``User`` into the API user payload."""

    # Imported lazily: app.deps.auth imports this module, so a module-level
    # import would be circular.
    from app.deps.auth import impersonated_by, impersonation_readonly

    admin_id = impersonated_by(user)
    return UserResponse(
        id=user.id,
        portal_role=user.portal_role,
        status=user.status,
        instagram_username=user.instagram_username,
        email=user.edu_email,
        pending_edu_email=user.pending_edu_email,
        instagram_reconnect_required=await org_owes_instagram_reconnect(db, user),
        impersonated_by=uuid.UUID(admin_id) if admin_id else None,
        impersonation_readonly=impersonation_readonly(user) if admin_id else None,
    )


class StaleRefreshToken(Exception):
    """Presented ``token_version`` lost the row-lock race; do not bump."""


async def issue_token_pair(
    db: AsyncSession,
    user: User,
    *,
    expected_version: int | None = None,
) -> tuple[str, str]:
    """Bump ``token_version``, then mint ``(access_token, refresh_token)``.

    ``FOR UPDATE`` serializes concurrent mints on the same row and reloads
    ``token_version`` so a waiter cannot both compute ``old+1`` from a stale
    snapshot (auth.ci-session-restore-flake v6).

    Commits the bump here so the ``FOR UPDATE`` lock is released before the
    response is built, and so the new ``ver`` is durable even if a caller
    inspects the row before ``get_db`` commits. Callers must therefore mint
    last; nothing may write after this returns.

    ``expected_version`` is compare-and-swap for ``/refresh``: after the row
    lock, a superseded cookie must raise ``StaleRefreshToken`` without bumping
    (auth.refresh-rotation-not-compare-and-swap). Login-style callers leave it
    ``None`` so a new session still revokes outstanding ones. Do not rollback
    on stale — the route catches and returns 401; ``get_db`` then commits an
    empty txn and releases the lock.
    """

    await db.refresh(user, with_for_update=True)
    if expected_version is not None and (user.token_version or 0) != expected_version:
        raise StaleRefreshToken()
    bump_token_version(user)
    await db.commit()
    ver = user.token_version or 0
    access = jwt.create_access_token(user.id, user.portal_role, user.status, token_version=ver)
    refresh = jwt.create_refresh_token(user.id, token_version=ver)
    return access, refresh
