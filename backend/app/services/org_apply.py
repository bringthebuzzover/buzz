"""Claimed Instagram @handle validation, uniqueness, and bind-mismatch helpers."""

from __future__ import annotations

import re
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.services.instagram import canonical_instagram_handle

# Instagram username: 1–30 chars, letters/digits/._ ; not starting/ending with .
_HANDLE_RE = re.compile(r"^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$")


def normalize_claimed_handle(raw: str) -> str:
    handle = canonical_instagram_handle(raw)
    if not handle or not _HANDLE_RE.match(handle):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Enter a valid Instagram username (letters, numbers, periods, underscores).",
            status_code=400,
        )
    return handle


def clear_ig_bind_mismatch(org: Organization) -> None:
    """Drop an open or historical Connect mismatch flag (switch / erase)."""

    org.ig_bind_mismatched_at = None
    org.ig_bind_graph_username = None
    org.ig_bind_mismatch_acked_at = None


def flag_ig_bind_mismatch(org: Organization, graph_handle: str, now: datetime) -> None:
    """Record that Connect bound a different @ than the claimed tester target."""

    org.ig_bind_mismatched_at = now
    org.ig_bind_graph_username = graph_handle
    org.ig_bind_mismatch_acked_at = None


def ig_bind_mismatch_open(org: Organization | None) -> bool:
    if org is None or org.ig_bind_mismatched_at is None:
        return False
    return org.ig_bind_mismatch_acked_at is None


async def assert_handle_available(
    db: AsyncSession,
    handle: str,
    *,
    exclude_user_id: uuid.UUID | None = None,
) -> None:
    """Claimed @handle unique among non-erased orgs (case-insensitive)."""
    stmt = select(User).where(
        User.portal_role == PortalRole.ORG.value,
        User.status != OrgUserStatus.ERASED.value,
        func.lower(User.instagram_username) == handle.lower(),
    )
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    existing = await db.scalar(stmt)
    if existing is not None:
        raise BuzzAPIException(
            errors.INSTAGRAM_HANDLE_TAKEN,
            "That Instagram handle is already claimed by another organization.",
            status_code=409,
        )
