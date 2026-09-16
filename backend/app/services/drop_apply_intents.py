"""Org signup intents to apply to a drop before ``active`` (PRODUCT §7.1).

Intent rows are **not** applicants. ``promote_drop_apply_intents`` is the only
path that writes ``drop_applications``, and it must never fail Connect / skip-
Connect Approve.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.drop_apply_intent import DropApplyIntent
from app.models.enums import ApplicationDecision, DropApplyIntentStatus
from app.models.organization import Organization
from app.models.user import User
from app.services.drops import (
    _require_browsable_drop,
    apply_to_drop,
    drop_apply_eligibility,
)

logger = logging.getLogger(__name__)


def _pitch_clean(pitch: str | None) -> str | None:
    return pitch.strip() if pitch and pitch.strip() else None


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _is_upcoming(drop: Drop, *, now: datetime) -> bool:
    return now < _as_utc(drop.apply_open_at)


async def _accepted_count(db: AsyncSession, drop_id: uuid.UUID) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(DropApplication)
        .where(
            DropApplication.drop_id == drop_id,
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
        )
    )
    return int(count or 0)


async def _intent_status_for_drop(db: AsyncSession, drop: Drop) -> str:
    """``open`` while apply is possible or still Upcoming; else ``expired``."""

    now = datetime.now(timezone.utc)
    if _is_upcoming(drop, now=now):
        return DropApplyIntentStatus.OPEN.value
    accepted = await _accepted_count(db, drop.id)
    try:
        drop_apply_eligibility(drop, now=now, accepted_count=accepted)
    except BuzzAPIException as exc:
        if exc.code in (errors.DROP_NOT_OPEN, errors.CAPACITY_EXCEEDED):
            return DropApplyIntentStatus.EXPIRED.value
        raise
    return DropApplyIntentStatus.OPEN.value


async def record_drop_apply_intent(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    drop_id: uuid.UUID,
    pitch: str | None,
) -> DropApplyIntent:
    """Upsert one intent per ``(org_id, drop_id)``.

    Unpublished / hidden / finished / unknown → ``DROP_NOT_OPEN`` (do not
    leak drafts). Closed / capacity-full still writes an **expired** row so
    admin can see the attempt. Upcoming stays ``open`` so Connect after the
    window opens can still promote. Reopen: expired → open when the drop is
    apply-eligible again. Promoted rows are left alone.
    """

    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.DROP_NOT_OPEN, "This drop is not available.")
    await _require_browsable_drop(db, drop)

    next_status = await _intent_status_for_drop(db, drop)
    pitch_clean = _pitch_clean(pitch)

    existing = await db.scalar(
        select(DropApplyIntent).where(
            DropApplyIntent.org_id == org_id,
            DropApplyIntent.drop_id == drop_id,
        )
    )
    if existing is None:
        intent = DropApplyIntent(
            id=uuid.uuid4(),
            org_id=org_id,
            drop_id=drop_id,
            pitch=pitch_clean,
            status=next_status,
        )
        db.add(intent)
        await db.flush()
        return intent

    if existing.status == DropApplyIntentStatus.PROMOTED.value:
        return existing

    existing.pitch = pitch_clean
    existing.status = next_status
    await db.flush()
    return existing


async def expire_stale_intents_for_drop(db: AsyncSession, drop: Drop) -> None:
    """Lazily mark open intents expired when the window/capacity/visibility died.

    Does not delete — admin still lists expired rows.
    """

    open_rows = list(
        await db.scalars(
            select(DropApplyIntent).where(
                DropApplyIntent.drop_id == drop.id,
                DropApplyIntent.status == DropApplyIntentStatus.OPEN.value,
            )
        )
    )
    if not open_rows:
        return

    next_status = DropApplyIntentStatus.OPEN.value
    try:
        await _require_browsable_drop(db, drop)
        next_status = await _intent_status_for_drop(db, drop)
    except BuzzAPIException as exc:
        if exc.code in (errors.DROP_NOT_OPEN, errors.CAPACITY_EXCEEDED, errors.NOT_FOUND):
            next_status = DropApplyIntentStatus.EXPIRED.value
        else:
            raise

    if next_status != DropApplyIntentStatus.EXPIRED.value:
        return
    for row in open_rows:
        row.status = DropApplyIntentStatus.EXPIRED.value
    await db.flush()


async def list_intents_for_drop(db: AsyncSession, drop: Drop) -> list[DropApplyIntent]:
    """Admin listing: open + expired (not promoted). Lazy-expire first."""

    await expire_stale_intents_for_drop(db, drop)
    rows = list(
        await db.scalars(
            select(DropApplyIntent)
            .where(
                DropApplyIntent.drop_id == drop.id,
                DropApplyIntent.status != DropApplyIntentStatus.PROMOTED.value,
            )
            .order_by(DropApplyIntent.created_at.asc())
        )
    )
    return rows


async def get_intent_for_org_drop(
    db: AsyncSession, *, org_id: uuid.UUID, drop_id: uuid.UUID
) -> DropApplyIntent | None:
    drop = await db.get(Drop, drop_id)
    if drop is not None:
        await expire_stale_intents_for_drop(db, drop)
    row: DropApplyIntent | None = await db.scalar(
        select(DropApplyIntent).where(
            DropApplyIntent.org_id == org_id,
            DropApplyIntent.drop_id == drop_id,
        )
    )
    return row


async def expire_open_intents_for_org(db: AsyncSession, org_id: uuid.UUID) -> None:
    """Deny: close leftover open intents; keep rows + pitch for admin."""

    await db.execute(
        update(DropApplyIntent)
        .where(
            DropApplyIntent.org_id == org_id,
            DropApplyIntent.status == DropApplyIntentStatus.OPEN.value,
        )
        .values(status=DropApplyIntentStatus.EXPIRED.value)
    )
    await db.flush()


async def expire_and_clear_intents_for_org(db: AsyncSession, org_id: uuid.UUID) -> None:
    """Erase: expire leftover open intents and strip pitch (org is tombstoned)."""

    await db.execute(
        update(DropApplyIntent)
        .where(
            DropApplyIntent.org_id == org_id,
            DropApplyIntent.status == DropApplyIntentStatus.OPEN.value,
        )
        .values(status=DropApplyIntentStatus.EXPIRED.value)
    )
    await db.execute(
        update(DropApplyIntent).where(DropApplyIntent.org_id == org_id).values(pitch=None)
    )
    await db.flush()


async def _should_expire_unopen_drop(db: AsyncSession, drop_id: uuid.UUID) -> bool:
    """True when DROP_NOT_OPEN means closed/hidden/finished, not still Upcoming."""

    drop = await db.get(Drop, drop_id)
    if drop is None:
        return True
    try:
        await _require_browsable_drop(db, drop)
    except BuzzAPIException:
        return True
    return not _is_upcoming(drop, now=datetime.now(timezone.utc))


async def promote_drop_apply_intents(db: AsyncSession, user: User) -> None:
    """Apply every still-open intent. Never raises to the Connect caller."""

    try:
        await _promote_drop_apply_intents(db, user)
    except Exception:
        logger.exception("promote_drop_apply_intents failed user_id=%s", user.id)


async def _promote_drop_apply_intents(db: AsyncSession, user: User) -> None:
    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is None:
        return
    intents = list(
        await db.scalars(
            select(DropApplyIntent).where(
                DropApplyIntent.org_id == org.id,
                DropApplyIntent.status == DropApplyIntentStatus.OPEN.value,
            )
        )
    )
    for intent in intents:
        try:
            await apply_to_drop(db, user, intent.drop_id, intent.pitch)
            intent.status = DropApplyIntentStatus.PROMOTED.value
        except BuzzAPIException as exc:
            if exc.code == errors.ALREADY_APPLIED:
                intent.status = DropApplyIntentStatus.PROMOTED.value
            elif exc.code == errors.CAPACITY_EXCEEDED or exc.code == errors.NOT_FOUND:
                intent.status = DropApplyIntentStatus.EXPIRED.value
            elif exc.code == errors.DROP_NOT_OPEN:
                if await _should_expire_unopen_drop(db, intent.drop_id):
                    intent.status = DropApplyIntentStatus.EXPIRED.value
            else:
                logger.warning(
                    "promote intent left open org_id=%s drop_id=%s code=%s",
                    org.id,
                    intent.drop_id,
                    exc.code,
                )
        except Exception:
            logger.exception(
                "promote intent unexpected org_id=%s drop_id=%s",
                org.id,
                intent.drop_id,
            )
    await db.flush()
