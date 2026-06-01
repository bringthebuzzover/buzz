"""Pydantic request/response models for the auth surface (architecture.md §5.5).

Response models are nested inside the standard ``{ data, meta, error }``
envelope by the route layer (``api_response(data=...)``). The refresh token is
never serialized here — it rides the httpOnly cookie.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel


class InstagramCallbackRequest(BaseModel):
    """Body for ``POST /api/auth/instagram/callback``."""

    code: str
    state: str


class UserResponse(BaseModel):
    """Current-user payload returned by login + ``GET /api/auth/me`` (§6.2)."""

    id: uuid.UUID
    portal_role: str
    status: str
    instagram_username: str | None = None
    email: str | None = None


class TokenResponse(BaseModel):
    """Login result. Refresh token rides the cookie, not this body."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse


class RefreshResponse(BaseModel):
    """Result of a successful ``POST /api/auth/refresh``."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
