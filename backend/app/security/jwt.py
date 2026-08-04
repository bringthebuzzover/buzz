"""Buzz-issued JWT encode/decode (architecture.md §5.3).

Three token *types*, all signed with ``settings.SECRET_KEY`` /
``settings.JWT_ALGORITHM`` and carrying an explicit ``type`` claim so none
can be replayed as another:

* ``access``      — short-lived bearer for ``Authorization: Bearer`` (1h).
* ``refresh``     — long-lived, ridden in the httpOnly cookie (7d).
* ``oauth_state`` — short-lived CSRF token for the Instagram OAuth round-trip.

The ``type`` claim on the *access* token intentionally extends §5.3 (which
lists it only on refresh); the symmetry is what makes a refresh/state token
presented as a bearer detectable.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pydantic import BaseModel

from app.config import settings

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
OAUTH_STATE_TOKEN_TYPE = "oauth_state"


class TokenError(Exception):
    """Base for decode failures."""


class TokenExpiredError(TokenError):
    """The token's ``exp`` is in the past (caller maps to ``TOKEN_EXPIRED``)."""


class TokenInvalidError(TokenError):
    """Bad signature, malformed, or wrong ``type`` (caller maps to ``UNAUTHORIZED``)."""


class TokenPayload(BaseModel):
    """Decoded claim set. ``role``/``status`` are present only on access tokens."""

    sub: str
    type: str
    jti: str
    iat: int
    exp: int
    role: str | None = None
    status: str | None = None
    nonce: str | None = None
    ver: int | None = None  # users.token_version at mint time (access + refresh)
    imp: str | None = None  # admin user id when this is an impersonation token
    imp_readonly: bool | None = None  # impersonation session may not mutate


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode(claims: dict[str, Any]) -> str:
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(
    user_id: uuid.UUID | str,
    role: str,
    status: str,
    *,
    token_version: int = 0,
    impersonated_by: uuid.UUID | str | None = None,
    readonly: bool = False,
) -> str:
    """Mint a short-lived access token carrying role + status (§5.3).

    When ``impersonated_by`` is set the token is an *impersonation* token: it
    acts as ``user_id`` but records the admin behind it in ``imp`` and uses the
    shorter ``IMPERSONATION_TOKEN_TTL_MINUTES`` lifetime. ``readonly`` stamps
    ``imp_readonly``, which the auth dependency enforces on mutating requests.

    ``token_version`` is stamped as ``ver`` so logout / deny / re-login can
    revoke outstanding access tokens the same way refresh tokens already are.
    """

    issued = _now()
    ttl_minutes = (
        settings.IMPERSONATION_TOKEN_TTL_MINUTES
        if impersonated_by is not None
        else settings.ACCESS_TOKEN_TTL_MINUTES
    )
    claims: dict[str, Any] = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN_TYPE,
        "role": role,
        "status": status,
        "iat": issued,
        "exp": issued + timedelta(minutes=ttl_minutes),
        "jti": uuid.uuid4().hex,
        "ver": token_version,
    }
    if impersonated_by is not None:
        claims["imp"] = str(impersonated_by)
        claims["imp_readonly"] = readonly
    return _encode(claims)


def create_refresh_token(user_id: uuid.UUID | str, token_version: int = 0) -> str:
    """Mint a long-lived refresh token (no role/status; reload on use).

    Carries the user's ``token_version`` so a server-side bump (logout / admin
    revoke) invalidates every outstanding refresh token at once (§11.1).
    """

    issued = _now()
    claims: dict[str, Any] = {
        "sub": str(user_id),
        "type": REFRESH_TOKEN_TYPE,
        "iat": issued,
        "exp": issued + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
        "jti": uuid.uuid4().hex,
        "ver": token_version,
    }
    return _encode(claims)


def create_oauth_state_token() -> str:
    """Mint a signed, short-lived CSRF ``state`` for the OAuth round-trip."""

    issued = _now()
    claims: dict[str, Any] = {
        "sub": "oauth",
        "type": OAUTH_STATE_TOKEN_TYPE,
        "nonce": uuid.uuid4().hex,
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.OAUTH_STATE_TTL_MINUTES),
        "jti": uuid.uuid4().hex,
    }
    return _encode(claims)


def decode_token(token: str, *, expected_type: str) -> TokenPayload:
    """Verify signature + ``exp`` + ``type``; return the typed payload.

    Raises ``TokenExpiredError`` on expiry and ``TokenInvalidError`` on a bad
    signature, malformed token, or a ``type`` mismatch.
    """

    try:
        raw: dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError(str(exc)) from exc
    except jwt.PyJWTError as exc:
        raise TokenInvalidError(str(exc)) from exc

    if raw.get("type") != expected_type:
        raise TokenInvalidError(f"expected token type {expected_type!r}, got {raw.get('type')!r}")

    try:
        return TokenPayload.model_validate(raw)
    except ValueError as exc:  # pragma: no cover - malformed claims
        raise TokenInvalidError(str(exc)) from exc
