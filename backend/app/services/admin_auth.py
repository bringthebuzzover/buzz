"""Admin password login and impersonation.

Admins have no Instagram identity and no invite flow, so they authenticate with
``users.edu_email`` + ``users.password_hash`` — the same bcrypt primitives the
brand portal uses.

Impersonation is stateless: :func:`mint_impersonation_token` returns an access
token whose ``sub`` is the target user, so every existing route scopes itself to
that user with no changes. The admin behind it rides in the ``imp`` claim, and
no refresh token is issued — the admin's own refresh cookie stays untouched, so
"Exit" is just dropping the impersonation access token.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.enums import OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import UserResponse
from app.security import jwt
from app.security.password import verify_password

# Same constant-work trick as brand login: always run exactly one bcrypt verify
# so response timing can't distinguish "no such admin" from "wrong password".
_DUMMY_HASH = "$2b$12$BjsWQMEoE/Jrr8bmN2pUfO0P1IFZpAURUcSq7qQGTYUimfCYgUX6S"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def login_admin(db: AsyncSession, email: str, password: str) -> tuple[User, UserResponse]:
    """Authenticate an admin by email + password.

    Returns ``(user, user_response)`` so the route layer can issue tokens.
    """

    normalized = email.strip().lower()
    user = await db.scalar(
        select(User).where(
            func.lower(User.edu_email) == normalized,
            User.portal_role == PortalRole.ADMIN.value,
        )
    )

    eligible = (
        user is not None and user.status == OrgUserStatus.ACTIVE.value and bool(user.password_hash)
    )
    stored_hash = user.password_hash if (eligible and user and user.password_hash) else _DUMMY_HASH
    password_ok = verify_password(password, stored_hash)
    if not eligible or not password_ok or user is None:
        raise BuzzAPIException(
            errors.UNAUTHORIZED,
            "Invalid email or password.",
            status_code=401,
        )

    user.last_login_at = _now()
    await db.flush()

    return user, UserResponse(
        id=user.id,
        portal_role=user.portal_role,
        status=user.status,
        instagram_username=user.instagram_username,
        email=user.edu_email,
    )


async def mint_impersonation_token(
    db: AsyncSession,
    admin: User,
    target_user_id: object,
) -> tuple[str, UserResponse]:
    """Issue a short-lived access token that acts as ``target_user_id``.

    Refuses admin targets (no privilege laundering between admins) and any
    target that isn't ``active`` — those users can't reach a portal anyway, so
    impersonating them would only produce confusing guard redirects.
    """

    target = await db.get(User, target_user_id)
    if target is None:
        raise BuzzAPIException(errors.NOT_FOUND, "User not found.", status_code=404)

    if target.portal_role == PortalRole.ADMIN.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Admins cannot impersonate other admins.",
            status_code=403,
        )

    if target.status != OrgUserStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Only active accounts can be impersonated.",
            status_code=403,
        )

    token = jwt.create_access_token(
        target.id,
        target.portal_role,
        target.status,
        impersonated_by=admin.id,
        readonly=settings.IMPERSONATION_READONLY,
    )

    return token, UserResponse(
        id=target.id,
        portal_role=target.portal_role,
        status=target.status,
        instagram_username=target.instagram_username,
        email=target.edu_email,
        impersonated_by=admin.id,
        impersonation_readonly=settings.IMPERSONATION_READONLY,
    )


async def list_impersonatable_users(db: AsyncSession) -> list[dict[str, object]]:
    """Every org + brand user, with a display name pulled from their profile.

    Admins are excluded — they are not valid impersonation targets.
    """

    rows = list(
        await db.execute(
            select(User, Organization, Brand)
            .outerjoin(Organization, Organization.user_id == User.id)
            .outerjoin(Brand, Brand.user_id == User.id)
            .where(User.portal_role != PortalRole.ADMIN.value)
            .order_by(User.portal_role.asc(), User.created_at.asc())
        )
    )

    return [
        {
            "id": user.id,
            "portal_role": user.portal_role,
            "status": user.status,
            "display_name": (
                org.org_name if org is not None else (brand.brand_name if brand else None)
            ),
            "email": (brand.company_email if brand is not None else user.edu_email),
            "instagram_handle": user.instagram_username,
            "impersonatable": user.status == OrgUserStatus.ACTIVE.value,
            "created_at": user.created_at,
        }
        for user, org, brand in rows
    ]
