"""Org profile orchestration (architecture.md §5.1 ``/api/orgs/me``).

Pure service functions (no FastAPI types) the route layer calls.

``edu_email`` and ``instagram_handle`` on the wire come from ``users``
(login identity), not from the organizations row.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import User
from app.schemas.orgs import OrgProfileResponse, OrgProfileUpdate
from app.services.instagram import canonical_instagram_handle


async def get_org_for_user(db: AsyncSession, user: User) -> Organization | None:
    """The ``organizations`` row owned by ``user``, or ``None``."""

    org: Organization | None = await db.scalar(
        select(Organization).where(Organization.user_id == user.id)
    )
    return org


def build_org_profile(org: Organization, user: User) -> OrgProfileResponse:
    """Serialize an org profile with identity fields from ``user``."""

    return OrgProfileResponse(
        id=org.id,
        org_name=org.org_name,
        university=org.university,
        edu_email=user.edu_email or "",
        instagram_handle=canonical_instagram_handle(user.instagram_username),
        tiktok_handle=org.tiktok_handle,
        follower_count=org.follower_count,
        member_count=org.member_count,
        category=org.category,
        city=org.city,
        state=org.state,
        contact_name=org.contact_name,
        delivery_address=org.delivery_address,
        approved_at=org.approved_at,
        created_at=org.created_at,
    )


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
