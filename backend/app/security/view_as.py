"""HttpOnly View-as intent cookie.

The cookie is not an access token. ``POST /api/admin/impersonate/resume``
reads it only after the caller has already authenticated as the same admin.
Path is ``/api`` so logout (``/api/auth``) and resume (``/api/admin``) both
see it. The admin refresh cookie stays on ``/api/auth`` and is never replaced.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Request, Response

from app.config import settings
from app.security import jwt

# Sent to every ``/api/*`` route, not to the SPA document.
VIEW_AS_COOKIE_PATH = "/api"


def set_view_as_cookie(response: Response, token: str, *, max_age: int | None = None) -> None:
    response.set_cookie(
        key=settings.VIEW_AS_COOKIE_NAME,
        value=token,
        max_age=(settings.VIEW_AS_INTENT_TTL_HOURS * 60 * 60 if max_age is None else max_age),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=VIEW_AS_COOKIE_PATH,
    )


def rebind_view_as_cookie(
    request: Request,
    response: Response,
    *,
    admin_id: str,
    previous_version: int,
    new_version: int,
) -> None:
    """Point a live intent at the admin session refresh just rotated.

    Refresh bumps ``token_version``, so the next resume would see an
    ``imp_ver`` mismatch unless this rewrite happens in the same response.
    The original ``exp`` and the remaining cookie max-age are kept — this
    does not grant another 8h. A cookie for a different session is left
    for resume to reject. An expired or bad cookie is cleared.
    """

    raw = request.cookies.get(settings.VIEW_AS_COOKIE_NAME)
    if not raw:
        return
    try:
        payload = jwt.decode_token(raw, expected_type=jwt.VIEW_AS_TOKEN_TYPE)
    except jwt.TokenError:
        clear_view_as_cookie(response)
        return
    target_id = payload.sub
    role = payload.role
    if (
        payload.imp != admin_id
        or payload.imp_ver != previous_version
        or target_id is None
        or (role != "org" and role != "brand")
    ):
        return
    exp = datetime.fromtimestamp(payload.exp, tz=timezone.utc)
    remaining = int((exp - datetime.now(timezone.utc)).total_seconds())
    if remaining <= 0:
        clear_view_as_cookie(response)
        return
    intent = jwt.create_view_as_intent_token(
        admin_id,
        target_id,
        role,
        impersonator_token_version=new_version,
        expires_at=exp,
    )
    set_view_as_cookie(response, intent, max_age=remaining)


def clear_view_as_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.VIEW_AS_COOKIE_NAME,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=VIEW_AS_COOKIE_PATH,
    )
