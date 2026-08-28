"""One-shot: convert unpublished request_received stubs into closed tickets.

LAUNCH.md Phase B / B6b. Idempotent — a second write run is a no-op.

    poetry run python scripts/cleanup_request_received_stubs.py --dry-run
    poetry run python scripts/cleanup_request_received_stubs.py
    poetry run python scripts/cleanup_request_received_stubs.py --confirm  # production writes

``--dry-run`` prints the stub set with no writes (ok in production).
Production writes refuse unless ``--confirm`` is passed after explicit ops OK.
``--dry-run`` and ``--confirm`` are mutually exclusive.
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


async def _main(*, force: bool, dry_run: bool) -> None:
    async with async_session_factory() as db:
        result = await cleanup_request_received_stubs(
            db, force=force, dry_run=dry_run
        )
        if not dry_run:
            await db.commit()
    await engine.dispose()
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count matching stubs and print ids; do not write.",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required for writes when ENVIRONMENT=production.",
    )
    args = parser.parse_args()
    if args.dry_run and args.confirm:
        print("refusing: --dry-run and --confirm are mutually exclusive.", file=sys.stderr)
        raise SystemExit(2)
    if (
        not args.dry_run
        and settings.ENVIRONMENT == "production"
        and not args.confirm
    ):
        print(
            "refusing: ENVIRONMENT=production. Re-run with --dry-run, or --confirm after explicit ops OK.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    asyncio.run(_main(force=args.confirm, dry_run=args.dry_run))
