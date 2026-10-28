"""One-off cleanup for apply drafts left by already-erased orgs.

From the API container::

    .venv/bin/python -m app.erased_apply_prefills count
    .venv/bin/python -m app.erased_apply_prefills delete --yes

``count`` is the default. It prints counts and matched row ids. It does not
print emails, handles, or addresses, and it does not commit. ``delete``
without ``--yes`` writes nothing. With ``--yes`` it deletes the matched rows
in one statement and prints the count. A database error prints a generic
message. The engine hides bound parameters so a traceback cannot show them.

Matching rules live in ``app.services.erased_apply_prefill_leftovers``.
"""

from __future__ import annotations

import asyncio
import logging
import sys

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.services.erased_apply_prefill_leftovers import (
    ErasureNotice,
    ErasureScanError,
    delete_leftover_prefills,
    earliest_erasure_by_email,
    fetch_org_erasure_notices,
    leftover_prefill_ids,
    unclaimed_prefill_count,
)

_USAGE = "usage: python -m app.erased_apply_prefills [count|delete --yes]"
logger = logging.getLogger(__name__)

_engine = create_async_engine(settings.DATABASE_URL, future=True, hide_parameters=True)
async_session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


async def _notices() -> list[ErasureNotice]:
    key = settings.RESEND_API_KEY.strip()
    if not key:
        raise ErasureScanError("RESEND_API_KEY is unset. Nothing was deleted.")
    timeout = httpx.Timeout(20.0)
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=False, headers=headers
    ) as client:
        return await fetch_org_erasure_notices(client)


async def _count() -> int:
    try:
        notices = await _notices()
    except ErasureScanError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    try:
        async with async_session_factory() as session:
            ids = await leftover_prefill_ids(session, notices)
            unclaimed = await unclaimed_prefill_count(session)
            await session.rollback()
    except Exception:
        logger.error("erased apply prefill count failed")
        print("Database error. Nothing was deleted.", file=sys.stderr)
        return 1
    print(f"matched={len(ids)}")
    print(f"unclaimed={unclaimed}")
    print(f"org_erasure_notices={len(earliest_erasure_by_email(notices))}")
    for row_id in ids:
        print(f"id={row_id}")
    return 0


async def _delete() -> int:
    try:
        notices = await _notices()
    except ErasureScanError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    try:
        async with async_session_factory() as session:
            deleted = await delete_leftover_prefills(session, notices)
            await session.commit()
    except Exception:
        logger.error("erased apply prefill delete failed")
        print("Database error. Nothing was deleted.", file=sys.stderr)
        return 1
    print(f"deleted={deleted}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args == ["count"]:
        return asyncio.run(_count())
    if args == ["delete"]:
        print(
            "delete removes matched apply drafts. Re-run with: delete --yes",
            file=sys.stderr,
        )
        return 2
    if args == ["delete", "--yes"]:
        return asyncio.run(_delete())
    print(_USAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
