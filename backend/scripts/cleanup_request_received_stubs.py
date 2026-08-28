"""One-shot: convert unpublished request_received stubs into closed tickets.

LAUNCH.md Phase B / B6b. Idempotent — a second run is a no-op.

    poetry run python scripts/cleanup_request_received_stubs.py
    poetry run python scripts/cleanup_request_received_stubs.py --confirm  # production

Production refuses unless ``--confirm`` is passed after explicit ops OK.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.deps.db import async_session_factory, engine  # noqa: E402
from app.services.admin import cleanup_request_received_stubs  # noqa: E402


async def _main(*, force: bool) -> None:
    async with async_session_factory() as db:
        result = await cleanup_request_received_stubs(db, force=force)
        await db.commit()
    await engine.dispose()
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required when ENVIRONMENT=production.",
    )
    args = parser.parse_args()
    if settings.ENVIRONMENT == "production" and not args.confirm:
        print(
            "refusing: ENVIRONMENT=production. Re-run with --confirm after explicit ops OK.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    asyncio.run(_main(force=args.confirm))
