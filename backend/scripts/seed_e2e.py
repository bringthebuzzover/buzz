"""E2E seed: the standard dev seed + one drop guaranteed to be applyable.

The Playwright suite auto-logs-in as the default active org, which has already
applied to every open drop in the base seed — so there'd be no enabled "Apply"
button to exercise. This adds one OPEN drop (stable title "E2E Open Drop") with
no application from the active org, giving the apply journey a deterministic
target. Run by the Playwright global-setup before the suite.

    poetry run python scripts/seed_e2e.py
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.deps.db import async_session_factory, engine  # noqa: E402
from app.models.drop import Drop  # noqa: E402
from app.models.enums import BrandTrackerStage  # noqa: E402
from scripts.seed_dev import _seed, _uuid  # noqa: E402

E2E_DROP_ID = uuid.UUID(int=99)
E2E_DROP_TITLE = "E2E Open Drop"


async def _add_open_drop() -> None:
    now = datetime.now(timezone.utc)
    async with async_session_factory() as db:
        db.add(
            Drop(
                id=E2E_DROP_ID,
                brand_id=_uuid(20),  # Acme Coffee (from seed_dev)
                title=E2E_DROP_TITLE,
                description="Deterministic open drop for the apply E2E.",
                image="https://example.test/e2e.png",
                location="E2E Campus",
                capacity_total=20,
                apply_open_at=now - timedelta(days=1),
                apply_close_at=now + timedelta(days=14),
                manual_reopen=False,
                brand_tracker_stage=BrandTrackerStage.REQUEST_RECEIVED.value,
            )
        )
        await db.commit()
    await engine.dispose()


async def _main() -> None:
    await _seed()  # truncates + reseeds (disposes the engine at the end)
    await _add_open_drop()
    print(f"e2e seed -> added open drop '{E2E_DROP_TITLE}'")


if __name__ == "__main__":
    asyncio.run(_main())
