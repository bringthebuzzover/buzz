"""Drop auto-close job (architecture.md §10.2).

Every ~5 minutes. The feed status is already derived from ``apply_close_at`` +
capacity (``getDropFeedStatus``), so this job's real work is the one tracker
transition that is *time*-driven rather than fulfillment-driven: when a drop's
application window closes, move it from ``request_received`` into
``finalizing_agreements`` — the "ready for applicant selection" stage where the
brand/admin runs ``finalize-applicants`` (which itself requires that stage AND a
closed window, §8.3). The later fulfillment stages stay admin-only (§8.5).

Idempotent: only drops still in ``request_received`` with a passed window and
``manual_reopen = false`` are advanced; re-running touches nothing new.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.drop import Drop
from app.models.enums import BrandTrackerStage
from app.models.tracker_event import DropTrackerEvent

_AUTO_NOTE = "auto: application window closed — ready for applicant selection"


async def auto_close_drops(db: AsyncSession) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    drops = list(
        await db.scalars(
            select(Drop).where(
                Drop.apply_close_at < now,
                Drop.manual_reopen.is_(False),
                Drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value,
            )
        )
    )

    for drop in drops:
        drop.brand_tracker_stage = BrandTrackerStage.FINALIZING_AGREEMENTS.value
        db.add(
            DropTrackerEvent(
                drop_id=drop.id,
                stage=BrandTrackerStage.FINALIZING_AGREEMENTS.value,
                note=_AUTO_NOTE,
            )
        )

    await db.flush()
    return {"advanced": len(drops)}
