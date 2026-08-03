"""Idempotent, non-destructive test accounts — safe to run against any env.

Unlike ``seed_dev.py`` (localhost-only, TRUNCATEs every table) this script only
inserts or updates three fixed rows, so it can be run once against Railway after
a deploy to make production reachable for testing.

Accounts
--------
``admin``
    Email + password. The only admin session entry point off-dev, since
    ``dev-login`` 404s when ``ENVIRONMENT != development``.

``brand``
    Email + password, ``users.status=active`` and ``brands.status=approved``, so
    it can log in directly at ``/brand/login`` (invite flow skipped).

``org``
    ``users.status=active`` plus an ``organizations`` profile, but deliberately
    **no Instagram token**: org login is Instagram-only and a synthetic IG id
    can't complete OAuth. Reach this account with admin "View as" at ``/admin``.
    Instagram-backed features (metric sync, post pull) skip tokenless users, so
    its feeds render empty.

Usage
-----

::

    # Local
    cd backend
    poetry run python scripts/upsert_test_accounts.py

    # Railway (one-off, after deploy). Passwords are REQUIRED off-dev.
    TEST_ADMIN_PASSWORD=... TEST_BRAND_PASSWORD=... \\
        railway run python scripts/upsert_test_accounts.py
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.config import settings  # noqa: E402
from app.deps.db import async_session_factory, engine  # noqa: E402
from app.models import Brand, Organization, User  # noqa: E402
from app.models.enums import (  # noqa: E402
    BrandStatus,
    OrgCategory,
    OrgUserStatus,
    PortalRole,
)
from app.security.password import hash_password  # noqa: E402

# Stable high-numbered UUIDs so these never collide with seed_dev's 1..100 range.
ADMIN_ID = uuid.UUID(int=9001)
BRAND_USER_ID = uuid.UUID(int=9002)
BRAND_ID = uuid.UUID(int=9003)
ORG_USER_ID = uuid.UUID(int=9004)
ORG_ID = uuid.UUID(int=9005)

ADMIN_EMAIL = "admin@bringthebuzzover.com"
BRAND_EMAIL = "test-brand@bringthebuzzover.com"
ORG_EDU_EMAIL = "test-org@cornell.edu"

# Local-only fallbacks. The guard below requires explicit env vars off-dev so a
# production deploy can never end up with a committed password.
_DEFAULT_PASSWORD = "buzzdev123"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _password(var: str) -> str:
    value = os.environ.get(var, "").strip()
    if value:
        return value
    if settings.ENVIRONMENT != "development":
        print(
            f"refusing to run: {var} must be set when ENVIRONMENT="
            f"{settings.ENVIRONMENT!r}. Committed defaults are development-only.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return _DEFAULT_PASSWORD


async def _upsert_admin(session: AsyncSession, password: str) -> User:
    user = await session.get(User, ADMIN_ID)
    if user is None:
        user = User(id=ADMIN_ID)
        session.add(user)
    user.portal_role = PortalRole.ADMIN.value
    user.status = OrgUserStatus.ACTIVE.value
    user.edu_email = ADMIN_EMAIL
    user.password_hash = hash_password(password)
    return user


async def _upsert_brand(session: AsyncSession, password: str) -> User:
    user = await session.get(User, BRAND_USER_ID)
    if user is None:
        user = User(id=BRAND_USER_ID)
        session.add(user)
    user.portal_role = PortalRole.BRAND.value
    user.status = OrgUserStatus.ACTIVE.value
    user.password_hash = hash_password(password)

    brand = await session.get(Brand, BRAND_ID)
    if brand is None:
        brand = Brand(id=BRAND_ID, user_id=BRAND_USER_ID)
        session.add(brand)
    brand.brand_name = "Buzz Test Brand"
    brand.company_email = BRAND_EMAIL
    brand.instagram_handle = "buzztestbrand"
    brand.intent_message = "Permanent QA account."
    brand.status = BrandStatus.APPROVED.value
    brand.approved_at = brand.approved_at or _now()
    return user


async def _upsert_org(session: AsyncSession) -> User:
    user = await session.get(User, ORG_USER_ID)
    if user is None:
        user = User(id=ORG_USER_ID)
        session.add(user)
    user.portal_role = PortalRole.ORG.value
    user.status = OrgUserStatus.ACTIVE.value
    user.edu_email = ORG_EDU_EMAIL
    user.email_verified_at = user.email_verified_at or _now()
    # Synthetic IG identity with NO access token: enough for the profile/handle
    # display, not enough to pretend the account can log in via OAuth.
    user.instagram_user_id = "buzz_test_org"
    user.instagram_username = "buzztestorg"

    org = await session.get(Organization, ORG_ID)
    if org is None:
        org = Organization(id=ORG_ID, user_id=ORG_USER_ID)
        session.add(org)
    org.org_name = "Buzz Test Organization"
    org.university = "Cornell University"
    org.edu_email = ORG_EDU_EMAIL
    org.instagram_handle = "buzztestorg"
    org.category = OrgCategory.SOCIAL.value
    org.follower_count = 1200
    org.member_count = 40
    org.city = "Ithaca"
    org.state = "NY"
    org.contact_name = "Buzz QA"
    org.approved_at = org.approved_at or _now()
    return user


async def _assert_email_not_taken(session: AsyncSession) -> None:
    """Fail loudly if a *different* row already owns one of our fixed emails.

    ``users.edu_email`` and ``brands.company_email`` are unique, so colliding
    with a real account would otherwise surface as an opaque IntegrityError.
    """

    checks = (
        (ADMIN_EMAIL, ADMIN_ID),
        (ORG_EDU_EMAIL, ORG_USER_ID),
    )
    for email, expected_id in checks:
        existing = await session.scalar(select(User).where(User.edu_email == email))
        if existing is not None and existing.id != expected_id:
            print(
                f"refusing to run: {email} already belongs to user {existing.id}.",
                file=sys.stderr,
            )
            raise SystemExit(2)

    brand = await session.scalar(select(Brand).where(Brand.company_email == BRAND_EMAIL))
    if brand is not None and brand.id != BRAND_ID:
        print(
            f"refusing to run: {BRAND_EMAIL} already belongs to brand {brand.id}.",
            file=sys.stderr,
        )
        raise SystemExit(2)


async def main() -> None:
    admin_password = _password("TEST_ADMIN_PASSWORD")
    brand_password = _password("TEST_BRAND_PASSWORD")

    async with async_session_factory() as session:
        await _assert_email_not_taken(session)
        await _upsert_admin(session, admin_password)
        await _upsert_brand(session, brand_password)
        await _upsert_org(session)
        await session.commit()

    await engine.dispose()

    print("test accounts upserted:")
    print(f"  admin  {ADMIN_EMAIL}  -> /admin/login")
    print(f"  brand  {BRAND_EMAIL}  -> /brand/login")
    print(f"  org    {ORG_EDU_EMAIL}  -> /admin 'View as' (no Instagram login)")


if __name__ == "__main__":
    asyncio.run(main())
