"""Background-job runner (architecture.md §10 / §1.3).

A scheduler (Railway Cron) invokes one job per command, e.g.::

    poetry run python scripts/run_job.py drop_autoclose
    poetry run python scripts/run_job.py token_cleanup
    poetry run python scripts/run_job.py autolink_scan
    poetry run python scripts/run_job.py token_refresh
    poetry run python scripts/run_job.py metric_sync

Each job opens its own session, runs, commits, and prints a JSON summary. The
IG-backed jobs use the real ``get_instagram_client``. Exit code is non-zero on
failure so the scheduler can alert. Every invocation also writes a ``job_runs``
row for thin observability.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.deps.db import async_session_factory  # noqa: E402
from app.jobs.autolink_scan import scan_autolink  # noqa: E402
from app.jobs.drop_autoclose import auto_close_drops  # noqa: E402
from app.jobs.metric_sync import sync_metrics  # noqa: E402
from app.jobs.token_cleanup import cleanup_tokens  # noqa: E402
from app.jobs.token_refresh import refresh_due_tokens  # noqa: E402
from app.models.job_run import JobRun  # noqa: E402
from app.services.instagram import close_instagram_client, get_instagram_client  # noqa: E402

# job name -> (callable, needs_instagram_client)
_JOBS = {
    "drop_autoclose": (auto_close_drops, False),
    "token_cleanup": (cleanup_tokens, False),
    "autolink_scan": (scan_autolink, False),
    "token_refresh": (refresh_due_tokens, True),
    "metric_sync": (sync_metrics, True),
}


async def _run(name: str) -> dict:
    fn, needs_ig = _JOBS[name]
    started = datetime.now(timezone.utc)
    async with async_session_factory() as db:
        run = JobRun(job=name, started_at=started, ok=False)
        db.add(run)
        await db.flush()
        try:
            result = await (fn(db, get_instagram_client()) if needs_ig else fn(db))
            run.ok = True
            run.summary = result
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            return result
        except Exception:
            run.ok = False
            run.finished_at = datetime.now(timezone.utc)
            run.summary = {"error": "job failed"}
            try:
                await db.commit()
            except Exception:  # noqa: BLE001 — best-effort persist of failure row
                await db.rollback()
            raise
        finally:
            if needs_ig:
                await close_instagram_client()


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in _JOBS:
        sys.stderr.write(f"usage: run_job.py <{' | '.join(_JOBS)}>\n")
        raise SystemExit(2)

    name = sys.argv[1]
    result = asyncio.run(_run(name))
    print(json.dumps({"job": name, **result}))


if __name__ == "__main__":
    main()
