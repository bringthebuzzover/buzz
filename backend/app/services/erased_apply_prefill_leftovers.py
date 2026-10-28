"""Attribute leftover apply drafts to orgs erased before the freeze migration.

The freeze migration deletes ``org_apply_prefills`` only by ``used_by_user_id``.
Erased orgs already had a null school email and a null claimed handle, so an
unclaimed draft that merely stored those values cannot be joined to the user
row. Handle text and shipping text are not match keys: both were cleared on
the org, and a live applicant's pending draft stores them too.

An unclaimed draft is eligible when Resend still has an org-erasure message
for its ``edu_email`` or ``invite_email``, the draft was created at or before
the earliest such message, and no non-erased user currently holds that
address. A draft whose ``used_by_user_id`` is an erased org user is eligible
on that link alone. A draft used by any other account stays.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from sqlalchemy import and_, delete, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import Exists

from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_apply_prefill import OrgApplyPrefill
from app.models.user import User

logger = logging.getLogger(__name__)

RESEND_EMAILS_URL = "https://api.resend.com/emails"
ORG_ERASURE_SUBJECT = "Your Buzz account data has been deleted"
# Present in every shipped org-erasure body. Brand erasure uses the same
# subject and does not include this phrase.
ORG_ERASURE_BODY_MARKER = "Instagram credentials"
_LIST_PAGE_SIZE = 100
_MAX_LIST_PAGES = 200
_RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


class ErasureScanError(Exception):
    """Resend could not be scanned. Callers must not delete."""


@dataclass(frozen=True)
class ErasureNotice:
    email: str
    erased_at: datetime


def normalize_email(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def parse_resend_timestamp(value: str) -> datetime:
    """Parse a Resend ``created_at`` into aware UTC."""

    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    elif text.endswith("+00") and not text.endswith("+00:00"):
        text = text[:-3] + "+00:00"
    elif text.endswith("-00") and not text.endswith("-00:00"):
        text = text[:-3] + "-00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def is_org_erasure_message(subject: object, text: object, html: object) -> bool:
    if not isinstance(subject, str) or subject.strip() != ORG_ERASURE_SUBJECT:
        return False
    body = ""
    if isinstance(text, str):
        body += text
    if isinstance(html, str):
        body += html
    return ORG_ERASURE_BODY_MARKER in body


def earliest_erasure_by_email(notices: Sequence[ErasureNotice]) -> dict[str, datetime]:
    """Earliest erasure instant per address. Blank addresses are dropped."""

    out: dict[str, datetime] = {}
    for notice in notices:
        email = normalize_email(notice.email)
        if "@" not in email:
            continue
        erased_at = notice.erased_at
        if erased_at.tzinfo is None:
            erased_at = erased_at.replace(tzinfo=timezone.utc)
        else:
            erased_at = erased_at.astimezone(timezone.utc)
        current = out.get(email)
        if current is None or erased_at < current:
            out[email] = erased_at
    return out


def _erased_org_user_ids() -> Select[tuple[uuid.UUID]]:
    return select(User.id).where(
        User.portal_role == PortalRole.ORG.value,
        User.status == OrgUserStatus.ERASED.value,
    )


def _live_user_holds(email: str) -> Exists:
    return exists(
        select(User.id).where(
            User.status != OrgUserStatus.ERASED.value,
            or_(
                func.lower(func.trim(User.edu_email)) == email,
                func.lower(func.trim(User.pending_edu_email)) == email,
            ),
        )
    )


def _match_filters(notices: Sequence[ErasureNotice]) -> list[ColumnElement[bool]]:
    filters: list[ColumnElement[bool]] = [
        OrgApplyPrefill.used_by_user_id.in_(_erased_org_user_ids())
    ]
    for email, cutoff in earliest_erasure_by_email(notices).items():
        filters.append(
            and_(
                OrgApplyPrefill.used_by_user_id.is_(None),
                OrgApplyPrefill.created_at <= cutoff,
                or_(
                    func.lower(func.trim(OrgApplyPrefill.edu_email)) == email,
                    func.lower(func.trim(OrgApplyPrefill.invite_email)) == email,
                ),
                ~_live_user_holds(email),
            )
        )
    return filters


async def leftover_prefill_ids(
    db: AsyncSession, notices: Sequence[ErasureNotice]
) -> list[uuid.UUID]:
    rows = await db.scalars(
        select(OrgApplyPrefill.id).where(or_(*_match_filters(notices))).order_by(OrgApplyPrefill.id)
    )
    return list(rows)


async def unclaimed_prefill_count(db: AsyncSession) -> int:
    value = await db.scalar(
        select(func.count())
        .select_from(OrgApplyPrefill)
        .where(OrgApplyPrefill.used_by_user_id.is_(None))
    )
    return int(value or 0)


async def delete_leftover_prefills(db: AsyncSession, notices: Sequence[ErasureNotice]) -> int:
    """Delete the current match set. Does not commit."""

    ids = await leftover_prefill_ids(db, notices)
    if not ids:
        return 0
    result = await db.execute(
        delete(OrgApplyPrefill)
        .where(
            OrgApplyPrefill.id.in_(ids),
            or_(
                OrgApplyPrefill.used_by_user_id.is_(None),
                OrgApplyPrefill.used_by_user_id.in_(_erased_org_user_ids()),
            ),
        )
        .returning(OrgApplyPrefill.id)
    )
    return len(list(result.scalars()))


def _json_object(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise ErasureScanError("Resend returned an unexpected payload. Nothing was deleted.")
    out: dict[str, object] = {}
    for key, value in payload.items():
        if not isinstance(key, str):
            raise ErasureScanError("Resend returned an unexpected payload. Nothing was deleted.")
        out[key] = value
    return out


def _recipient_emails(value: object) -> list[str]:
    raw: list[object]
    if isinstance(value, str):
        raw = [value]
    elif isinstance(value, list):
        raw = list(value)
    else:
        return []
    emails: list[str] = []
    for item in raw:
        email = normalize_email(item)
        if "@" in email:
            emails.append(email)
    return emails


def _email_id(value: object) -> str:
    if not isinstance(value, str):
        raise ErasureScanError("Resend list entry is missing an id. Nothing was deleted.")
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise ErasureScanError(
            "Resend list entry has an invalid id. Nothing was deleted."
        ) from None


async def _get_json(
    client: httpx.AsyncClient, url: str, params: dict[str, str] | None
) -> dict[str, object]:
    delay = 0.5
    last_status = 0
    for attempt in range(4):
        try:
            resp = await client.get(url, params=params)
        except httpx.HTTPError:
            logger.error("resend request failed")
            raise ErasureScanError("Resend request failed. Nothing was deleted.") from None
        last_status = resp.status_code
        if resp.status_code in _RETRY_STATUSES and attempt < 3:
            await asyncio.sleep(delay)
            delay *= 2
            continue
        if resp.status_code != 200:
            logger.error("resend request failed status=%s", resp.status_code)
            raise ErasureScanError(
                f"Resend request failed (status={resp.status_code}). Nothing was deleted."
            )
        try:
            payload: object = resp.json()
        except ValueError:
            raise ErasureScanError(
                "Resend returned a body that is not JSON. Nothing was deleted."
            ) from None
        return _json_object(payload)
    logger.error("resend request failed status=%s", last_status)
    raise ErasureScanError(f"Resend request failed (status={last_status}). Nothing was deleted.")


async def fetch_org_erasure_notices(client: httpx.AsyncClient) -> list[ErasureNotice]:
    """List org-erasure recipients Resend still has. Raises on a partial scan."""

    notices: list[ErasureNotice] = []
    after: str | None = None
    seen_cursors: set[str] = set()
    for _page in range(_MAX_LIST_PAGES):
        params = {"limit": str(_LIST_PAGE_SIZE)}
        if after is not None:
            params["after"] = after
        payload = await _get_json(client, RESEND_EMAILS_URL, params)
        data = payload.get("data")
        if data is None:
            data = []
        if not isinstance(data, list):
            raise ErasureScanError("Resend returned an unexpected list. Nothing was deleted.")
        if not data:
            if payload.get("has_more") is True:
                raise ErasureScanError("Resend pagination returned no rows. Nothing was deleted.")
            return notices
        page_ids: list[str] = []
        for item in data:
            row = _json_object(item)
            email_id = _email_id(row.get("id"))
            page_ids.append(email_id)
            subject = row.get("subject")
            if not isinstance(subject, str) or subject.strip() != ORG_ERASURE_SUBJECT:
                continue
            body = await _get_json(client, f"{RESEND_EMAILS_URL}/{email_id}", None)
            if not is_org_erasure_message(subject, body.get("text"), body.get("html")):
                continue
            created = row.get("created_at")
            if not isinstance(created, str):
                raise ErasureScanError(
                    "Org-erasure message is missing a timestamp. Nothing was deleted."
                )
            try:
                erased_at = parse_resend_timestamp(created)
            except ValueError:
                raise ErasureScanError(
                    "Org-erasure message has an unreadable timestamp. Nothing was deleted."
                ) from None
            for email in _recipient_emails(row.get("to")):
                notices.append(ErasureNotice(email=email, erased_at=erased_at))
        last_id = page_ids[-1]
        if last_id in seen_cursors:
            raise ErasureScanError("Resend pagination did not advance. Nothing was deleted.")
        seen_cursors.add(last_id)
        if payload.get("has_more") is not True:
            return notices
        after = last_id
    raise ErasureScanError("Resend list exceeded the page cap. Nothing was deleted.")
