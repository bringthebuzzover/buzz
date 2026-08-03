"""Admin endpoint schemas (architecture.md §5.1, §8.5)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import field_serializer

from app.schemas.auth import UserResponse
from app.schemas.common import CamelModel


class AdminPendingOrgItem(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    org_name: str
    university: str
    instagram_handle: str | None
    follower_count: int | None
    member_count: int | None
    status: str
    created_at: datetime

    @field_serializer("created_at")
    def _created_at_epoch(self, value: datetime) -> int:
        return int(value.timestamp() * 1000)


class AdminPendingBrandItem(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    brand_name: str
    company_email: str
    intent_message: str | None
    instagram_handle: str | None
    status: str
    created_at: datetime

    @field_serializer("created_at")
    def _created_at_epoch(self, value: datetime) -> int:
        return int(value.timestamp() * 1000)


class TrackerAdvanceRequest(CamelModel):
    stage: str
    tracking_number: str | None = None
    note: str | None = None


class AdminUserItem(CamelModel):
    """A row in the ``/api/admin/users`` impersonation picker."""

    id: uuid.UUID
    portal_role: str
    status: str
    display_name: str | None
    email: str | None
    instagram_handle: str | None
    impersonatable: bool
    created_at: datetime

    @field_serializer("created_at")
    def _created_at_epoch(self, value: datetime) -> int:
        return int(value.timestamp() * 1000)


class ImpersonateResponse(CamelModel):
    """Result of ``POST /api/admin/impersonate/{user_id}``.

    Access token only — no refresh cookie is set, so the admin's own session
    survives and "Exit impersonation" is a pure client-side drop.
    """

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    readonly: bool
