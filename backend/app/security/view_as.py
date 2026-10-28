"""HttpOnly View-as intent cookie.

The cookie is not an access token. ``POST /api/admin/impersonate/resume``
reads it only after the caller has already authenticated as the same admin.
Path is ``/api`` so logout (``/api/auth``) and resume (``/api/admin``) both
see it. The admin refresh cookie stays on ``/api/auth`` and is never replaced.
"""

from __future__ import annotations

from fastapi import Response

from app.config import settings

# Sent to every ``/api/*`` route, not to the SPA document.
VIEW_AS_COOKIE_PATH = "/api"


def set_view_as_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.VIEW_AS_COOKIE_NAME,
        value=token,
        max_age=settings.VIEW_AS_INTENT_TTL_HOURS * 60 * 60,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=VIEW_AS_COOKIE_PATH,
    )


def clear_view_as_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.VIEW_AS_COOKIE_NAME,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=VIEW_AS_COOKIE_PATH,
    )
