"""Staging demo seed is opt-in, refuses production, and upserts once."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.models import Brand, Drop, DropApplication, Organization
from scripts.seed_dev import prod_db_hosts_from_env, resolve_seed_mode, upsert_staging_demo

_LOCAL = "postgresql+asyncpg://postgres:postgres@localhost:5432/buzz"
_REMOTE = "postgresql+asyncpg://postgres:postgres@db.example:5432/buzz"
_SPA = "http://localhost:3000"


def test_prod_hosts_parse_comma_list() -> None:
    assert prod_db_hosts_from_env(" Prod.Example , ,db.internal ") == {
        "prod.example",
        "db.internal",
    }
    assert prod_db_hosts_from_env("") == set()


_STAGING = {"environment": "staging", "confirm": "buzz-staging"}


@pytest.mark.parametrize(
    ("db_url", "overrides", "expected"),
    [
        (_LOCAL, {"environment": "development", "confirm": ""}, "local"),
        # The staging flag selects the demo upsert, even on localhost.
        (_LOCAL, {}, "staging"),
        (_LOCAL, {"frontend_url": "https://staging.bringthebuzzover.com"}, "staging"),
    ],
)
def test_seed_mode_allowed(db_url: str, overrides: dict, expected: str) -> None:
    kwargs = {**_STAGING, "prod_hosts": set(), "frontend_url": _SPA, **overrides}
    assert resolve_seed_mode(db_url, **kwargs) == expected


@pytest.mark.parametrize(
    ("db_url", "overrides"),
    [
        (_REMOTE, {"confirm": "yes"}),  # remote DB without the confirm flag
        (_LOCAL, {"environment": "production"}),  # production, even with the flag
        (_REMOTE, {"prod_hosts": {"db.example"}}),  # listed prod DB host
        (_LOCAL, {"frontend_url": "https://bringthebuzzover.com"}),  # prod SPA host
        (_LOCAL, {"frontend_url": "https://www.bringthebuzzover.com/login"}),
        (_LOCAL, {"frontend_url": "https://WWW.BringTheBuzzOver.com"}),
    ],
)
def test_seed_mode_refused(db_url: str, overrides: dict) -> None:
    kwargs = {**_STAGING, "prod_hosts": set(), "frontend_url": _SPA, **overrides}
    with pytest.raises(SystemExit):
        resolve_seed_mode(db_url, **kwargs)


async def test_staging_demo_upsert_is_idempotent(db_session) -> None:
    await upsert_staging_demo(db_session, password="sample-demo-pass")
    await db_session.commit()
    await upsert_staging_demo(db_session, password="sample-demo-pass")
    await db_session.commit()

    orgs = (
        await db_session.scalars(select(Organization).where(Organization.org_name == "Sample Org"))
    ).all()
    clubs = (
        await db_session.scalars(select(Organization).where(Organization.org_name == "Sample Club"))
    ).all()
    brands = (
        await db_session.scalars(select(Brand).where(Brand.brand_name == "Sample Brand"))
    ).all()
    drops = (
        await db_session.scalars(select(Drop).where(Drop.title == "Fall Cold Brew Launch"))
    ).all()
    assert len(orgs) == 1
    assert len(clubs) == 1
    assert orgs[0].university == "Sample University"
    assert len(brands) == 1
    assert brands[0].company_email == "sample-brand@example.com"
    assert len(drops) == 1
    assert drops[0].published_at is not None
    app_count = await db_session.scalar(
        select(func.count())
        .select_from(DropApplication)
        .where(DropApplication.drop_id == drops[0].id)
    )
    assert app_count == 2
