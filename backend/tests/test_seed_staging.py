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


def test_local_seed_mode_without_staging_flag() -> None:
    assert (
        resolve_seed_mode(
            _LOCAL,
            environment="development",
            confirm="",
            prod_hosts=set(),
            frontend_url=_SPA,
        )
        == "local"
    )


def test_staging_flag_selects_demo_upsert_even_on_localhost() -> None:
    assert (
        resolve_seed_mode(
            _LOCAL,
            environment="staging",
            confirm="buzz-staging",
            prod_hosts=set(),
            frontend_url=_SPA,
        )
        == "staging"
    )


def test_remote_without_flag_is_refused() -> None:
    with pytest.raises(SystemExit):
        resolve_seed_mode(
            _REMOTE,
            environment="staging",
            confirm="yes",
            prod_hosts=set(),
            frontend_url=_SPA,
        )


def test_production_is_refused_even_with_confirm_flag() -> None:
    with pytest.raises(SystemExit):
        resolve_seed_mode(
            _LOCAL,
            environment="production",
            confirm="buzz-staging",
            prod_hosts=set(),
            frontend_url=_SPA,
        )


def test_listed_prod_host_is_refused() -> None:
    with pytest.raises(SystemExit):
        resolve_seed_mode(
            _REMOTE,
            environment="staging",
            confirm="buzz-staging",
            prod_hosts={"db.example"},
            frontend_url=_SPA,
        )


@pytest.mark.parametrize(
    "frontend_url",
    [
        "https://bringthebuzzover.com",
        "https://www.bringthebuzzover.com/login",
        "https://WWW.BringTheBuzzOver.com",
    ],
)
def test_prod_frontend_host_is_refused(frontend_url: str) -> None:
    with pytest.raises(SystemExit):
        resolve_seed_mode(
            _LOCAL,
            environment="staging",
            confirm="buzz-staging",
            prod_hosts=set(),
            frontend_url=frontend_url,
        )


def test_staging_frontend_host_is_allowed() -> None:
    assert (
        resolve_seed_mode(
            _LOCAL,
            environment="staging",
            confirm="buzz-staging",
            prod_hosts=set(),
            frontend_url="https://staging.bringthebuzzover.com",
        )
        == "staging"
    )


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
