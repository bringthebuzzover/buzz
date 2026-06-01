"""Org profile orchestration (architecture.md §5.1 ``/api/orgs/me``).

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import User
from app.schemas.orgs import OrgProfileResponse, OrgProfileUpdate


async def get_org_for_user(db: AsyncSession, user: User) -> Organization | None:
    """The ``organizations`` row owned by ``user``, or ``None``."""

    org: Organization | None = await db.scalar(
        select(Organization).where(Organization.user_id == user.id)
    )
    return org


def build_org_profile(org: Organization) -> OrgProfileResponse:
    """Serialize an ``Organization`` ORM row into the wire schema."""

    return OrgProfileResponse.model_validate(org, from_attributes=True)


async def update_org_profile(
    db: AsyncSession,
    org: Organization,
    payload: OrgProfileUpdate,
) -> Organization:
    """Apply the provided (set) fields of ``payload`` to ``org`` and flush."""

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    await db.flush()
    return org
