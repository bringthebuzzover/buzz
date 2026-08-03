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

from fastapi import BackgroundTasks, Depends, Header, Request
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

# Methods that never mutate state, so a read-only impersonation session may run
# them. Everything else is rejected while `imp_readonly` is set.
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _unauthorized(message: str = "Authentication required.") -> BuzzAPIException:
    return BuzzAPIException(code=errors.UNAUTHORIZED, message=message, status_code=401)


# Impersonation state is request-scoped and rides the access token, so it is
# stashed on the loaded ``User`` as plain (unmapped, never-flushed) attributes
# rather than a column. These three helpers are the only sanctioned accessors.
_IMPERSONATED_BY_ATTR = "_buzz_impersonated_by"
_IMPERSONATION_READONLY_ATTR = "_buzz_impersonation_readonly"


def set_impersonation(user: User, impersonated_by: str | None, readonly: bool) -> None:
    """Record who is impersonating ``user`` for the duration of this request."""

    object.__setattr__(user, _IMPERSONATED_BY_ATTR, impersonated_by)
    object.__setattr__(user, _IMPERSONATION_READONLY_ATTR, readonly)


def impersonated_by(user: User) -> str | None:
    """Admin user id behind this request, or ``None`` when not impersonating."""

    return getattr(user, _IMPERSONATED_BY_ATTR, None)


def impersonation_readonly(user: User) -> bool:
    """Whether the current impersonation session is barred from mutating."""

    return bool(getattr(user, _IMPERSONATION_READONLY_ATTR, False))


async def _load_user_from_bearer(
    authorization: str | None,
    db: AsyncSession,
    method: str | None = None,
) -> User:
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

    # Impersonation lives entirely in the token — no schema, no server session.
    # The attributes are transient (never flushed) and let /me + the read-only
    # gate below see who is really behind the request.
    impersonated_by = payload.imp
    readonly = bool(payload.imp_readonly) if impersonated_by else False
    set_impersonation(user, impersonated_by, readonly)

    if readonly and method is not None and method.upper() not in _SAFE_METHODS:
        raise BuzzAPIException(
            code=errors.IMPERSONATION_READONLY,
            message=(
                "This is a read-only impersonation session. Exit impersonation " "to make changes."
            ),
            status_code=403,
        )
    return user


async def get_current_user(
    request: Request,
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

    user = await _load_user_from_bearer(authorization, db, request.method)
    maybe_refresh_on_login(user, background_tasks, ig)
    return user


async def get_current_user_optional(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like :func:`get_current_user` but returns ``None`` when unauthenticated."""

    if not authorization:
        return None
    return await _load_user_from_bearer(authorization, db, request.method)


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
# Admins must also be active (a suspended admin → 403), matching org/brand.
CurrentAdmin = Annotated[User, Depends(require_active_role(PortalRole.ADMIN))]

__all__ = [
    "get_current_user",
    "get_current_user_optional",
    "require_role",
    "require_status",
    "require_active_role",
    "set_impersonation",
    "impersonated_by",
    "impersonation_readonly",
    "CurrentUser",
    "CurrentOrg",
    "CurrentBrand",
    "CurrentAdmin",
]
