"""Notify Me reminder delivery (architecture.md §10.6, PRODUCT §6.3.1).

Every ~5 minutes. An org that tapped Notify Me on an Upcoming drop picked a
lead time (5 / 15 / 60 minutes); this job emails them once ``apply_open_at``
minus that lead time has passed, so the reminder lands while they can still be
first in line.

Idempotent via ``notify_me.sent_at``: stamped only when the provider accepts
the send, so a failed attempt stays eligible for the next run.
``FOR UPDATE SKIP LOCKED`` keeps two overlapping runs from double-sending.
Rows whose apply window has already closed are skipped rather than mailed —
a reminder to apply to a closed drop is worse than no reminder.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import BrandStatus, BrandTrackerStage
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.user import User
from app.services.email import send_drop_opening_reminder_email


async def send_due_reminders(db: AsyncSession) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    # make_interval(years, months, weeks, days, hours, mins) — the org's chosen
    # lead time as an interval so the due check stays one SQL predicate.
    lead_time = func.make_interval(0, 0, 0, 0, 0, NotifyMe.reminder_minutes)

    rows = list(
        (
            await db.execute(
                select(NotifyMe, Drop, Organization, User, Brand)
                .join(Drop, Drop.id == NotifyMe.drop_id)
                .join(Organization, Organization.id == NotifyMe.org_id)
                .join(User, User.id == Organization.user_id)
                .join(Brand, Brand.id == Drop.brand_id)
                .where(
                    NotifyMe.enabled.is_(True),
                    NotifyMe.sent_at.is_(None),
                    Drop.apply_open_at - lead_time <= now,
                    Drop.apply_close_at > now,
                    # Same browsable gate as the org feed / detail / notify APIs.
                    Brand.status == BrandStatus.APPROVED.value,
                    Drop.brand_tracker_stage != BrandTrackerStage.DROP_FINISHED.value,
                )
                .with_for_update(of=NotifyMe, skip_locked=True)
            )
        ).all()
    )

    sent = 0
    skipped = 0
    for notify, drop, org, user, brand in rows:
        if not user.edu_email:
            # No address to reach them on; leave sent_at NULL so the admin
            # health signal keeps surfacing the row instead of hiding it.
            skipped += 1
            continue
        ok = await send_drop_opening_reminder_email(
            user.edu_email,
            org_name=org.org_name,
            drop_title=drop.title,
            brand_name=brand.brand_name,
        )
        if not ok:
            # Leave sent_at NULL so the next cron run retries.
            continue
        notify.sent_at = now
        sent += 1

    await db.flush()
    return {"reminders_sent": sent, "reminders_skipped": skipped}
