"""Operator commands for the temporary reviewer path.

From ``backend/``::

    poetry run python -m app.meta_reviewer.cli mint-link
    poetry run python -m app.meta_reviewer.cli seed
    poetry run python -m app.meta_reviewer.cli purge --yes

``mint-link`` only prints a secret and its hash. It does not write the
database or a file. ``seed`` and ``purge`` are idempotent.
"""

from __future__ import annotations

import asyncio
import hashlib
import secrets
import sys

from app.config import settings
from app.deps.db import async_session_factory
from app.exceptions import BuzzAPIException
from app.meta_reviewer.gate import reviewer_access_enabled
from app.meta_reviewer.seed import purge_reviewer_org, seed_reviewer_org


def _print_link() -> None:
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    base = settings.FRONTEND_URL.rstrip("/")
    print("Set this env var on the API service (hash only), then restart it:")
    print(f"META_REVIEWER_LINK_SECRET_HASH={digest}")
    print()
    print("Give reviewers this link once. It is not stored. Mint again to rotate.")
    print(f"{base}/meta-review#{token}")
    print()
    print("Also set META_REVIEWER_ACCESS_ENABLED=true and META_REVIEWER_DROP_ID.")
    print("The link does nothing until the flag is on and the hash matches.")


async def _seed() -> int:
    if not reviewer_access_enabled():
        print("META_REVIEWER_ACCESS_ENABLED is off. Nothing was changed.", file=sys.stderr)
        return 1
    try:
        async with async_session_factory() as session:
            seeded = await seed_reviewer_org(session)
            await session.commit()
    except BuzzAPIException as exc:
        print(exc.message, file=sys.stderr)
        return 1
    print(
        "reviewer org ready "
        f"user_id={seeded['user_id']} org_id={seeded['org_id']} "
        f"drop_id={seeded['drop_id']} application_id={seeded['application_id']}"
    )
    return 0


async def _purge() -> int:
    try:
        async with async_session_factory() as session:
            deleted = await purge_reviewer_org(session)
            await session.commit()
    except BuzzAPIException as exc:
        print(exc.message, file=sys.stderr)
        return 1
    print("deleted reviewer org" if deleted else "no reviewer org row")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] not in {"mint-link", "seed", "purge"}:
        print(
            "usage: python -m app.meta_reviewer.cli mint-link|seed|purge --yes",
            file=sys.stderr,
        )
        return 2
    if args[0] == "mint-link":
        _print_link()
        return 0
    if args[0] == "seed":
        return asyncio.run(_seed())
    if args != ["purge", "--yes"]:
        print("purge deletes the reviewer org. Re-run with: purge --yes", file=sys.stderr)
        return 2
    return asyncio.run(_purge())


if __name__ == "__main__":
    raise SystemExit(main())
