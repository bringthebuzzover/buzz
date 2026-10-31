"""Alembic ↔ ORM parity check.

Catches the most common Stage 2+ pitfall: someone edits a model and
forgets to run ``alembic revision --autogenerate``. Without this test,
the local dev DB (which uses ``Base.metadata.create_all``) and the
migrated DB would slowly drift apart.

Strategy
--------
1. Spin up a throwaway database (``buzz_alembic_parity_<hash>``).
2. Run ``alembic upgrade head`` against it via subprocess so env.py
   wires up the ``Operations`` proxy the migration files need.
3. Run ``alembic check`` (Alembic ≥ 1.10) — it autogenerates against
   the live DB and exits non-zero if there is any drift from the ORM.
4. Drop the throwaway DB no matter what.

Subprocess execution is deliberate: the migration files use the global
``op.*`` proxy which is only bound during a real ``alembic`` CLI run.
Driving Alembic in-process from inside a pytest event loop requires
re-implementing that proxy plumbing, and the subprocess cost
(~1 second) is paid only once per CI build.
"""

from __future__ import annotations

import concurrent.futures
import os
import secrets
import shutil
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
import pytest

from app.config import settings

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _split_admin_url(database_url: str) -> tuple[str, str, str]:
    """Return ``(asyncpg admin url, db host bits, configured db name)``.

    The admin URL connects to the well-known ``postgres`` database so we
    can issue ``CREATE`` / ``DROP DATABASE`` without holding a connection
    open against the database being modified.
    """

    parsed = urlparse(database_url.replace("postgresql+asyncpg://", "postgresql://"))
    db_name = (parsed.path or "/").lstrip("/") or "postgres"
    user_info = f"{parsed.username}:{parsed.password}@" if parsed.username else ""
    host = parsed.hostname or "localhost"
    port = f":{parsed.port}" if parsed.port else ""
    admin_url = f"postgresql://{user_info}{host}{port}/postgres"
    return admin_url, db_name, parsed.geturl()


async def _create_db(admin_url: str, db_name: str) -> None:
    conn = await asyncpg.connect(admin_url)
    try:
        await conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await conn.close()


async def _drop_db(admin_url: str, db_name: str) -> None:
    conn = await asyncpg.connect(admin_url)
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
    finally:
        await conn.close()


def test_alembic_has_a_single_head() -> None:
    """Two revisions must not both claim the same parent."""

    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(_BACKEND_ROOT / "alembic.ini"))
    heads = ScriptDirectory.from_config(cfg).get_heads()
    assert len(heads) == 1, heads


def _run_alembic(args: list[str], parity_url: str) -> subprocess.CompletedProcess[str]:
    """Invoke ``poetry run alembic ...`` against the parity database."""

    poetry = shutil.which("poetry") or "poetry"
    env = os.environ.copy()
    env["DATABASE_URL"] = parity_url
    return subprocess.run(
        [poetry, "run", "alembic", *args],
        cwd=str(_BACKEND_ROOT),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.asyncio
async def test_alembic_matches_models() -> None:
    admin_url, _, _ = _split_admin_url(settings.DATABASE_URL)
    parity_db = f"buzz_alembic_parity_{secrets.token_hex(4)}"
    parity_url = (
        settings.DATABASE_URL.rsplit("/", 1)[0] + f"/{parity_db}"
        if "/" in settings.DATABASE_URL
        else f"postgresql+asyncpg://localhost/{parity_db}"
    )

    await _create_db(admin_url, parity_db)
    try:
        upgrade = _run_alembic(["upgrade", "head"], parity_url)
        assert upgrade.returncode == 0, (
            f"alembic upgrade head failed (exit {upgrade.returncode}):\n"
            f"STDOUT:\n{upgrade.stdout}\nSTDERR:\n{upgrade.stderr}"
        )

        check = _run_alembic(["check"], parity_url)
        assert check.returncode == 0, (
            "Alembic migrations have drifted from `Base.metadata`. Run "
            '`poetry run alembic revision --autogenerate -m "<slug>"` and '
            "review the diff before committing.\n"
            f"alembic check exit {check.returncode}:\n"
            f"STDOUT:\n{check.stdout}\nSTDERR:\n{check.stderr}"
        )
        await _assert_drop_request_columns_nullable(parity_url)
        await _assert_legacy_lifecycle_round_trip(parity_url)
    finally:
        await _drop_db(admin_url, parity_db)


async def _assert_legacy_lifecycle_round_trip(parity_url: str) -> None:
    """Rollback restores the old schema on a populated drop; re-upgrade preserves it."""
    conn = await asyncpg.connect(parity_url.replace("postgresql+asyncpg://", "postgresql://", 1))
    try:
        drop_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO drops (id, brand_id, title, description, image, location,
                               capacity_total, apply_open_at, apply_close_at)
            SELECT $1, id, 'Test drop', 'Test description', 'test.png', 'Test campus',
                   1, now(), now() + interval '1 day'
            FROM brands LIMIT 1
            """,
            drop_id,
        )
        legacy_columns = {
            "brand_tracker_stage",
            "manual_reopen",
            "applicant_selection_finalized_at",
            "tracking_number",
        }
        for direction, revision in (("downgrade", "c3e5a7b9d1f2"), ("upgrade", "head")):
            result = _run_alembic([direction, revision], parity_url)
            assert result.returncode == 0, result.stderr
            columns = {
                row["column_name"]: row
                for row in await conn.fetch(
                    "SELECT column_name, is_nullable, udt_name, character_maximum_length "
                    "FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'drops'"
                )
            }
            if direction == "downgrade":
                assert legacy_columns <= columns.keys()
                assert columns["brand_tracker_stage"]["udt_name"] == "brand_tracker_stage"
                assert columns["applicant_selection_finalized_at"]["udt_name"] == "timestamptz"
                assert columns["tracking_number"]["character_maximum_length"] == 255
                for name in legacy_columns - {"manual_reopen"}:
                    assert columns[name]["is_nullable"] == "YES"
                assert columns["manual_reopen"]["is_nullable"] == "NO"
                row = await conn.fetchrow(
                    "SELECT manual_reopen, brand_tracker_stage, "
                    "applicant_selection_finalized_at, tracking_number FROM drops WHERE id = $1",
                    drop_id,
                )
                assert tuple(row) == (False, None, None, None)
            else:
                assert legacy_columns.isdisjoint(columns)
            assert (
                await conn.fetchval("SELECT title FROM drops WHERE id = $1", drop_id) == "Test drop"
            )
    finally:
        await conn.close()


_STRUCTURED_DROP_REQUEST_COLUMNS = (
    "product",
    "title",
    "location",
    "target_date",
    "org_count",
    "units_per_org",
    "campaign_hashtag",
)


async def _assert_drop_request_columns_nullable(parity_url: str) -> None:
    """New intake columns are nullable, and a message/notes row still inserts."""

    admin_url = parity_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(admin_url)
    try:
        rows = await conn.fetch(
            """
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'drop_requests'
              AND column_name = ANY($1::text[])
            """,
            list(_STRUCTURED_DROP_REQUEST_COLUMNS),
        )
        found = {row["column_name"]: row["is_nullable"] for row in rows}
        assert set(found) == set(_STRUCTURED_DROP_REQUEST_COLUMNS)
        assert all(nullable == "YES" for nullable in found.values())

        user_id = uuid.uuid4()
        brand_id = uuid.uuid4()
        ticket_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO users (id, portal_role, status)
            VALUES ($1, 'brand'::portal_role, 'active'::org_user_status)
            """,
            user_id,
        )
        await conn.execute(
            """
            INSERT INTO brands (id, user_id, brand_name, company_email, status)
            VALUES ($1, $2, 'Legacy Brand', $3, 'approved'::brand_status)
            """,
            brand_id,
            user_id,
            f"legacy-{user_id.hex[:12]}@test.com",
        )
        await conn.execute(
            """
            INSERT INTO drop_requests (id, brand_id, message, notes)
            VALUES ($1, $2, 'old ticket', 'old notes')
            """,
            ticket_id,
            brand_id,
        )
        stored = await conn.fetchrow(
            """
            SELECT message, notes, product, title, location, target_date,
                   org_count, units_per_org, campaign_hashtag
            FROM drop_requests
            WHERE id = $1
            """,
            ticket_id,
        )
        assert stored is not None
        assert stored["message"] == "old ticket"
        assert stored["notes"] == "old notes"
        for column in _STRUCTURED_DROP_REQUEST_COLUMNS:
            assert stored[column] is None
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_concurrent_alembic_upgrade_head() -> None:
    """Two ``upgrade head`` processes must both succeed (api + cron pre-deploys)."""

    admin_url, _, _ = _split_admin_url(settings.DATABASE_URL)
    parity_db = f"buzz_alembic_lock_{secrets.token_hex(4)}"
    parity_url = (
        settings.DATABASE_URL.rsplit("/", 1)[0] + f"/{parity_db}"
        if "/" in settings.DATABASE_URL
        else f"postgresql+asyncpg://localhost/{parity_db}"
    )

    await _create_db(admin_url, parity_db)
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futs = [pool.submit(_run_alembic, ["upgrade", "head"], parity_url) for _ in range(2)]
            results = [fut.result() for fut in futs]
        for upgrade in results:
            assert upgrade.returncode == 0, (
                f"alembic upgrade head failed (exit {upgrade.returncode}):\n"
                f"STDOUT:\n{upgrade.stdout}\nSTDERR:\n{upgrade.stderr}"
            )
    finally:
        await _drop_db(admin_url, parity_db)
