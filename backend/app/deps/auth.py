"""FastAPI auth dependencies (architecture.md §5.4).

Three independent, composable gates:

* :func:`get_current_user`  — Authentication: a valid, non-expired access JWT
  that resolves to a real user.
* :func:`require_role`        — Role: ``portal_role`` ∈ allowed set.
* :func:`require_status`      — Status: ``status`` ∈ allowed set (default
  ``active``).

:func:`require_active_role` composes role + active-status into a single
dependency, and the ``CurrentOrg`` / ``CurrentBrand`` aliases build on it so
route signatures stay terse.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import BackgroundTasks, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.security import jwt
from app.services.instagram import InstagramClient, get_instagram_client
from app.services.instagram_token import maybe_refresh_on_login

_BEARER_PREFIX = "Bearer "


def _unauthorized(message: str = "Authentication required.") -> BuzzAPIException:
    return BuzzAPIException(code=errors.UNAUTHORIZED, message=message, status_code=401)


async def _load_user_from_bearer(authorization: str | None, db: AsyncSession) -> User:
    if not authorization or not authorization.startswith(_BEARER_PREFIX):
        raise _unauthorized("Missing or malformed Authorization header.")

    token = authorization[len(_BEARER_PREFIX) :].strip()
    try:
        payload = jwt.decode_token(token, expected_type=jwt.ACCESS_TOKEN_TYPE)
    except jwt.TokenExpiredError as exc:
        raise BuzzAPIException(
            code=errors.TOKEN_EXPIRED,
            message="Access token has expired.",
            status_code=401,
        ) from exc
    except jwt.TokenInvalidError as exc:
        raise _unauthorized("Invalid access token.") from exc

    try:
        user_id = uuid.UUID(payload.sub)
    except ValueError as exc:
        raise _unauthorized("Invalid token subject.") from exc

    user = await db.get(User, user_id)
    if user is None:
        raise _unauthorized("User no longer exists.")
    return user


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
    # FastAPI injects a real BackgroundTasks from the annotation; the None
    # default is only to satisfy Python's "defaults-after-defaults" rule.
    background_tasks: BackgroundTasks = None,  # type: ignore[assignment]
    ig: InstagramClient = Depends(get_instagram_client),
) -> User:
    """Authenticated user, or raise 401 (``UNAUTHORIZED`` / ``TOKEN_EXPIRED``).

    On every authenticated request this also runs the §10.5.1 on-login Instagram
    token check: a fire-and-forget background refresh when the long-lived token
    is within 30 days of expiry, or ``INSTAGRAM_TOKEN_EXPIRED`` once it's past.
    A no-op for non-org users and orgs without an IG token.
    """

    user = await _load_user_from_bearer(authorization, db)
    maybe_refresh_on_login(user, background_tasks, ig)
    return user


async def get_current_user_optional(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like :func:`get_current_user` but returns ``None`` when unauthenticated."""

    if not authorization:
        return None
    return await _load_user_from_bearer(authorization, db)


def require_role(*allowed: PortalRole) -> Callable[[User], Awaitable[User]]:
    """Dependency factory enforcing ``portal_role`` ∈ ``allowed`` (403 otherwise)."""

    allowed_values = {role.value for role in allowed}

    async def _dep(user: User = Depends(get_current_user)) -> User:
        # ``portal_role`` is ``Mapped[str]``; compare on value (PortalRole is a
        # StrEnum, so value equality holds) — do NOT switch this to ``is``.
        if user.portal_role not in allowed_values:
            raise BuzzAPIException(
                code=errors.FORBIDDEN,
                message="Your account role cannot access this resource.",
                status_code=403,
            )
        return user

    return _dep


def require_status(
    *allowed: OrgUserStatus,
) -> Callable[[User], Awaitable[User]]:
    """Dependency factory enforcing ``status`` ∈ ``allowed`` (default active)."""

    allowed_set = allowed or (OrgUserStatus.ACTIVE,)
    allowed_values = {status.value for status in allowed_set}

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if user.status not in allowed_values:
            raise BuzzAPIException(
                code=errors.FORBIDDEN,
                message="Your account is not active.",
                status_code=403,
            )
        return user

    return _dep


def require_active_role(role: PortalRole) -> Callable[[User], Awaitable[User]]:
    """Combined gate: the user must have ``role`` AND be ``active``."""

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if user.portal_role != role.value:
            raise BuzzAPIException(
                code=errors.FORBIDDEN,
                message="Your account role cannot access this resource.",
                status_code=403,
            )
        if user.status != OrgUserStatus.ACTIVE.value:
            raise BuzzAPIException(
                code=errors.FORBIDDEN,
                message="Your account is not active.",
                status_code=403,
            )
        return user

    return _dep


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentOrg = Annotated[User, Depends(require_active_role(PortalRole.ORG))]
CurrentBrand = Annotated[User, Depends(require_active_role(PortalRole.BRAND))]
CurrentAdmin = Annotated[User, Depends(require_role(PortalRole.ADMIN))]

__all__ = [
    "get_current_user",
    "get_current_user_optional",
    "require_role",
    "require_status",
    "require_active_role",
    "CurrentUser",
    "CurrentOrg",
    "CurrentBrand",
    "CurrentAdmin",
]
