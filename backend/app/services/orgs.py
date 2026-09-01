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
from app.services.address import AddressClient, apply_to_org
from app.services.instagram import canonical_instagram_handle

_SHIPPING_KEYS = frozenset(
    {
        "shipping_line1",
        "shipping_line2",
        "shipping_city",
        "shipping_state",
        "shipping_postal_code",
        "shipping_place_id",
    }
)


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
        pending_edu_email=user.pending_edu_email,
        instagram_handle=canonical_instagram_handle(user.instagram_username),
        tiktok_handle=org.tiktok_handle,
        follower_count=org.follower_count,
        member_count=org.member_count,
        category=org.category,
        city=org.city,
        state=org.state,
        contact_name=org.contact_name,
        delivery_address=org.delivery_address,
        shipping_line1=org.shipping_line1,
        shipping_line2=org.shipping_line2,
        shipping_city=org.shipping_city,
        shipping_state=org.shipping_state,
        shipping_postal_code=org.shipping_postal_code,
        approved_at=org.approved_at,
        created_at=org.created_at,
    )


async def update_org_profile(
    db: AsyncSession,
    org: Organization,
    payload: OrgProfileUpdate,
    addresses: AddressClient,
) -> Organization:
    """Apply the provided (set) fields of ``payload`` to ``org`` and flush."""

    data = payload.model_dump(exclude_unset=True)
    shipping = {k: data.pop(k) for k in list(data) if k in _SHIPPING_KEYS}
    if shipping:
        addr = await addresses.validate(
            line1=shipping["shipping_line1"],
            line2=shipping.get("shipping_line2"),
            city=shipping["shipping_city"],
            state=shipping["shipping_state"],
            postal_code=shipping["shipping_postal_code"],
            place_id=shipping.get("shipping_place_id"),
        )
        apply_to_org(org, addr)
    for field, value in data.items():
        setattr(org, field, value)
    await db.flush()
    return org
