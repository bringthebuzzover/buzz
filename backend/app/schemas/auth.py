"""Pydantic request/response models for the auth surface (architecture.md §5.5).

Response models are nested inside the standard ``{ data, meta, error }``
envelope by the route layer (``api_response(data=...)``). The refresh token is
never serialized here — it rides the httpOnly cookie.

``TokenResponse`` / ``UserResponse`` / ``RefreshResponse`` stay plain
``BaseModel`` (snake_case wire: ``access_token``, ``portal_role``). Do **not**
convert them to ``CamelModel`` — that would break login/refresh clients.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel


class InstagramCallbackRequest(BaseModel):
    """Body for ``POST /api/auth/instagram/callback``."""

    code: str
    state: str


class DevLoginRequest(BaseModel):
    """Body for the dev-only ``POST /api/auth/dev-login`` (both optional).

    With neither field set, the endpoint logs in the first seeded active org
    user — convenient for the Stage 4 frontend slice in local dev.
    """

    user_id: uuid.UUID | None = None
    instagram_user_id: str | None = None


class UserResponse(BaseModel):
    """Current-user payload returned by login + ``GET /api/auth/me`` (§6.2).

    ``impersonated_by`` is set only while an admin is viewing as this user; the
    SPA keys its exit banner off it.
    """

    id: uuid.UUID
    portal_role: str
    status: str
    instagram_username: str | None = None
    email: str | None = None
    pending_edu_email: str | None = None
    impersonated_by: uuid.UUID | None = None
    impersonation_readonly: bool | None = None


class TokenResponse(BaseModel):
    """Login result. Refresh token rides the cookie, not this body."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse


class RefreshResponse(BaseModel):
    """Result of a successful ``POST /api/auth/refresh``.

    ``user`` mirrors the payload that ``GET /api/auth/me`` would return for the
    bearer we just minted. Serializing both from the same transaction lets the
    SPA bootstrap without a follow-up ``/me`` — closing the
    ``token_version`` mint-then-read race
    (see ``gaps/auth.ci-session-restore-flake.md``).
    """

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse
