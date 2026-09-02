"""Org apply prefill drafts — lookup, mint, mark used."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.org_apply_prefill import OrgApplyPrefill
from app.security.one_shot_tokens import hash_token
from app.services.org_apply_prefill_parse import PREFILL_TTL_DAYS, ParsedPrefill

logger = logging.getLogger(__name__)

_PREFILL_NOT_FOUND = "This apply link is invalid or expired."


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_live_prefill(db: AsyncSession, raw_token: str) -> OrgApplyPrefill:
    token = (raw_token or "").strip()
    if not token:
        raise BuzzAPIException(errors.NOT_FOUND, _PREFILL_NOT_FOUND, status_code=404)
    row = await db.scalar(
        select(OrgApplyPrefill).where(OrgApplyPrefill.token_hash == hash_token(token))
    )
    if row is None or row.used_at is not None or row.expires_at <= _now():
        raise BuzzAPIException(errors.NOT_FOUND, _PREFILL_NOT_FOUND, status_code=404)
    return row


def prefill_to_public(row: OrgApplyPrefill) -> dict[str, Any]:
    return {
        "org_name": row.org_name,
        "university": row.university,
        "edu_email": row.edu_email,
        "instagram_handle": row.instagram_handle,
        "member_count": row.member_count,
        "category": row.category,
        "contact_name": row.contact_name,
        "shipping_line1": row.shipping_line1,
        "shipping_line2": row.shipping_line2,
        "shipping_city": row.shipping_city,
        "shipping_state": row.shipping_state,
        "shipping_postal_code": row.shipping_postal_code,
        "shipping_raw": row.shipping_raw,
    }


async def insert_prefill(
    db: AsyncSession,
    parsed: ParsedPrefill,
    *,
    source: str = "google_form",
) -> tuple[OrgApplyPrefill, str]:
    raw = secrets.token_urlsafe(32)
    row = OrgApplyPrefill(
        id=uuid.uuid4(),
        token_hash=hash_token(raw),
        invite_email=parsed.invite_email,
        org_name=parsed.org_name,
        university=parsed.university,
        edu_email=parsed.edu_email,
        instagram_handle=parsed.instagram_handle,
        member_count=parsed.member_count,
        category=parsed.category,
        contact_name=parsed.contact_name,
        shipping_line1=parsed.shipping_line1,
        shipping_line2=parsed.shipping_line2,
        shipping_city=parsed.shipping_city,
        shipping_state=parsed.shipping_state,
        shipping_postal_code=parsed.shipping_postal_code,
        shipping_raw=parsed.shipping_raw,
        extras=parsed.extras or None,
        source=source,
        source_row_key=parsed.source_row_key,
        expires_at=_now() + timedelta(days=PREFILL_TTL_DAYS),
    )
    db.add(row)
    await db.flush()
    return row, raw


async def find_by_source_row_key(db: AsyncSession, key: str | None) -> OrgApplyPrefill | None:
    if not key:
        return None
    row: OrgApplyPrefill | None = await db.scalar(
        select(OrgApplyPrefill).where(OrgApplyPrefill.source_row_key == key)
    )
    return row


async def mark_prefill_used(
    db: AsyncSession,
    raw_token: str | None,
    user_id: uuid.UUID,
) -> None:
    token = (raw_token or "").strip()
    if not token:
        return
    row = await db.scalar(
        select(OrgApplyPrefill).where(OrgApplyPrefill.token_hash == hash_token(token))
    )
    if row is None or row.used_at is not None or row.expires_at <= _now():
        return
    row.used_at = _now()
    row.used_by_user_id = user_id
    logger.info("org apply prefill used id=%s user_id=%s", row.id, user_id)
