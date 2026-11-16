"""Org Connect Instagram one-shot tokens.

Mirrors brand invite mint/redeem: invalidate prior unused tokens, hash at rest,
TTL from ``ORG_CONNECT_TOKEN_TTL_DAYS``.
"""

from __future__ import annotations

import secrets
import uuid
from collections.abc import Sequence
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_connect_token import OrgConnectToken
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.user import User
from app.security.one_shot_tokens import hash_token
from app.security.session import lock_user
from app.timeutils import utcnow

# Statuses in which an org that never connected Instagram can still be rescued by
# a Connect link. ``pending_approval`` is the backlog of orgs that verified their
# ``.edu`` under the apply-first flow, which never ran OAuth. A denied org gets
# here through ``undeny_org`` first, so it is not listed.
CONNECT_BEFORE_APPROVAL_STATUSES = frozenset({OrgUserStatus.PENDING_APPROVAL.value})


async def org_owes_instagram_reconnect(db: AsyncSession, user: User) -> bool:
    """Whether an active org has an approved switch still awaiting its bind."""
    if user.portal_role != PortalRole.ORG.value or user.status != OrgUserStatus.ACTIVE.value:
        return False
    return (await org_connect_actions(db, [user]))[user.id] == "switch"


def org_has_instagram_credentials(user: User) -> bool:
    """Whether the org row holds a Graph identity *and* a token."""
    return bool(user.instagram_user_id and user.instagram_access_token)


def org_awaits_initial_connect(user: User) -> bool:
    """Whether an unbound org still has to connect Instagram before approval.

    Signup is Instagram-first, so approval requires live credentials. These orgs
    verified their ``.edu`` under the retired apply-first flow and never did the
    handshake; they are the cohort a "send Connect link" admin action exists for.
    """

    return (
        user.portal_role == PortalRole.ORG.value
        and user.status in CONNECT_BEFORE_APPROVAL_STATUSES
        and not org_has_instagram_credentials(user)
    )


async def org_connect_actions(
    db: AsyncSession, users: Sequence[User]
) -> dict[uuid.UUID, str | None]:
    """Classify Connect actions for users with one switch-request lookup."""

    actions: dict[uuid.UUID, str | None] = {user.id: None for user in users}
    eligible_ids = [
        user.id
        for user in users
        if user.portal_role == PortalRole.ORG.value and user.status == OrgUserStatus.ACTIVE.value
    ]
    switch_user_ids: set[uuid.UUID] = set()
    if eligible_ids:
        switch_user_ids = set(
            await db.scalars(
                select(OrgIgChangeRequest.user_id).where(
                    OrgIgChangeRequest.user_id.in_(eligible_ids),
                    OrgIgChangeRequest.status == "awaiting_connect",
                    OrgIgChangeRequest.decided_kind == "account_switch",
                )
            )
        )

    for user in users:
        if user.id in switch_user_ids:
            actions[user.id] = "switch"
        elif org_awaits_initial_connect(user):
            actions[user.id] = "initial"
    return actions


async def org_may_connect_instagram(db: AsyncSession, user: User) -> bool:
    """Whether this org may start a bind OAuth / redeem a Connect link.

    Two cohorts qualify: an active org whose approved account switch released
    its credentials, and an unbound pre-approval org that never connected. Both
    need a bind; neither gains portal access from it (see
    :func:`redeem_org_connect_token`).
    """

    return org_awaits_initial_connect(user) or await org_owes_instagram_reconnect(db, user)


async def org_connect_action(db: AsyncSession, user: User) -> str | None:
    """Which admin Connect action reaches *user*, if any.

    ``"switch"`` — an active org whose approved switch released its credentials;
    the existing ``resend_org_connect`` path applies.
    ``"initial"`` — an unbound pre-approval org that has not connected yet;
    ``send_org_connect_link`` applies.
    ``None`` — nobody to email.

    Kept beside the two predicates so the bulk action and the per-org actions
    cannot drift about who they reach.
    """

    return (await org_connect_actions(db, [user]))[user.id]


async def create_org_connect_token(
    db: AsyncSession, org: Organization, user: User
) -> tuple[str, uuid.UUID]:
    """Invalidate prior unused connect tokens and mint a new raw token.

    Returns the raw token and the row id. The id is safe to put on a Resend
    idempotency key; the raw token is not.
    """
    locked_user = await lock_user(db, user.id)
    if locked_user is None or not await org_may_connect_instagram(db, locked_user):
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This account is not waiting to connect Instagram.",
            status_code=409,
        )
    user = locked_user
    now = utcnow()
    await db.execute(
        sa_update(OrgConnectToken)
        .where(
            OrgConnectToken.org_id == org.id,
            OrgConnectToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    raw = secrets.token_urlsafe(48)
    row = OrgConnectToken(
        id=uuid.uuid4(),
        user_id=user.id,
        org_id=org.id,
        token_hash=hash_token(raw),
        email=user.edu_email or "",
        expires_at=now + timedelta(days=settings.ORG_CONNECT_TOKEN_TTL_DAYS),
    )
    db.add(row)
    await db.flush()
    return raw, row.id


async def redeem_org_connect_token(db: AsyncSession, token: str) -> User:
    """Consume a connect token; return an org that may now bind Instagram.

    Two cohorts may redeem, and they are told apart by *current account state*,
    never by the token row:

    * **Switch holder** — ``active`` with an approved ``awaiting_connect``
      ticket. Its portal is already closed by the released credentials, so this
      session can only be used to finish the bind.
    * **Unbound before approval** — still ``pending_approval`` and holding no
      Graph identity or token because it verified its ``.edu`` under the
      retired apply-first flow. It never had portal access to lose.

    Neither cohort gains anything beyond a session from redeeming. The token
    grants no approval and no portal access: every ``/api/orgs`` route sits
    behind ``CurrentOrg`` (role *and* ``active``), the redemption writes no
    status, and an unbound pre-approval org therefore stays ``pending_approval``
    after it binds. Only ``approve_org`` — an admin action — moves it to
    ``active``, and it does so exactly because the bind supplied the credentials
    approval requires. A denied, erased, or otherwise non-eligible account is
    refused at redeem time even if it still holds an unused token, because the
    check below reads the live row.
    """
    token_hash = hash_token(token)
    user_id = await db.scalar(
        select(OrgConnectToken.user_id).where(OrgConnectToken.token_hash == token_hash)
    )
    user = await lock_user(db, user_id) if user_id is not None else None
    now = utcnow()
    row = await db.scalar(
        select(OrgConnectToken)
        .where(OrgConnectToken.token_hash == token_hash, OrgConnectToken.user_id == user_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    if row is None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_INVALID,
            "Invalid connect link.",
            status_code=400,
        )
    if row.used_at is not None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_USED,
            "This connect link has already been used.",
            status_code=400,
        )
    if row.expires_at < now:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "Connect link has expired. Ask Buzz to resend it.",
            status_code=400,
        )

    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "User not found.", status_code=404)
    if not await org_may_connect_instagram(db, user):
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This account is not waiting to connect Instagram.",
            status_code=400,
        )

    row.used_at = now
    await db.flush()
    return user
