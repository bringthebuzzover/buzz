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

import os
import secrets
import shutil
import subprocess
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
    finally:
        await _drop_db(admin_url, parity_db)
