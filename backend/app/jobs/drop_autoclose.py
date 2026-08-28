"""Drop auto-close job (architecture.md §10.2).

LAUNCH.md Phase B: autoclose only walks **published** drops. Legacy
``request_received`` stubs are frozen (hidden from the org feed) until the
one-shot cleanup converts them to tickets.

Published drops whose application window has closed and that are still in
``awaiting_products`` with no selection finalized stay put — later fulfillment
stages remain admin-only. This job currently records that the window closed
without advancing stage (no-op count for unpublished / stubs).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.drop import Drop
from app.models.enums import BrandTrackerStage


async def auto_close_drops(db: AsyncSession) -> dict[str, Any]:
    """No longer advances ``request_received`` stubs (Phase B).

    Returns counts for observability. Published drops with a closed window are
    left for brand finalize / admin tracker advances.
    """
    now = datetime.now(timezone.utc)

    stubs = list(
        await db.scalars(
            select(Drop).where(
                Drop.apply_close_at < now,
                Drop.manual_reopen.is_(False),
                Drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value,
                Drop.published_at.is_(None),
            )
        )
    )
    # Explicitly do not advance stubs — freeze until cleanup.
    published_closed = list(
        await db.scalars(
            select(Drop).where(
                Drop.apply_close_at < now,
                Drop.manual_reopen.is_(False),
                Drop.published_at.isnot(None),
                Drop.brand_tracker_stage == BrandTrackerStage.AWAITING_PRODUCTS.value,
            )
        )
    )

    await db.flush()
    return {
        "advanced": 0,
        "frozen_stubs": len(stubs),
        "published_closed_awaiting": len(published_closed),
    }
