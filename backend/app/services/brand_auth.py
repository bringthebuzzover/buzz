"""Brand auth orchestration: invite, set-password, login.

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.brand_invite_token import BrandInviteToken
from app.models.enums import BrandStatus, OrgUserStatus
from app.models.user import User
from app.schemas.auth import UserResponse
from app.security.password import hash_password, verify_password

# A fixed valid bcrypt hash used only to burn the same CPU as a real verify
# when the account doesn't exist, so login timing can't be used to enumerate
# registered brand emails.
_DUMMY_HASH = "$2b$12$BjsWQMEoE/Jrr8bmN2pUfO0P1IFZpAURUcSq7qQGTYUimfCYgUX6S"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def apply_brand(
    db: AsyncSession,
    *,
    brand_name: str,
    company_email: str,
    instagram_handle: str | None,
    intent_message: str | None,
) -> dict[str, str]:
    """Public brand self-registration → creates a User + pending_review Brand.

    Gated by ``settings.BRAND_SELF_REGISTRATION_ENABLED`` at the route layer.
    The brand user is non-active (``pending_approval``) and has no password
    until an admin approves and the invite/set-password flow runs.
    """
    email = company_email.strip().lower()

    # One brand per company email (case-insensitive). No existence leak beyond
    # the typed code — the email owner already knows they registered.
    existing = await db.scalar(select(Brand).where(func.lower(Brand.company_email) == email))
    if existing is not None:
        raise BuzzAPIException(
            errors.BRAND_EMAIL_TAKEN,
            "A brand account already exists for this email.",
            status_code=409,
        )

    user = User(
        id=uuid.uuid4(),
        portal_role="brand",
        status=OrgUserStatus.PENDING_APPROVAL.value,
    )
    db.add(user)
    await db.flush()

    brand = Brand(
        id=uuid.uuid4(),
        user_id=user.id,
        brand_name=brand_name.strip(),
        company_email=email,
        instagram_handle=(instagram_handle or None),
        intent_message=(intent_message or None),
        status=BrandStatus.PENDING_REVIEW.value,
    )
    db.add(brand)

    try:
        await db.flush()
    except IntegrityError as exc:
        raise BuzzAPIException(
            errors.BRAND_EMAIL_TAKEN,
            "A brand account already exists for this email.",
            status_code=409,
        ) from exc

    return {"brand_id": str(brand.id), "status": brand.status}


async def create_brand_invite(db: AsyncSession, brand: Brand, user: User) -> str:
    """Generate a BrandInviteToken for *brand* and return the raw token string."""
    token = secrets.token_urlsafe(48)
    now = _now()
    bit = BrandInviteToken(
        id=uuid.uuid4(),
        user_id=user.id,
        brand_id=brand.id,
        token=token,
        email=brand.company_email,
        expires_at=now + timedelta(days=settings.BRAND_INVITE_TOKEN_TTL_DAYS),
    )
    db.add(bit)
    await db.flush()
    return token


async def set_brand_password(db: AsyncSession, token: str, password: str) -> UserResponse:
    """Consume a brand invite token and set the user's password.

    On success the user is activated so they can log in.
    """
    now = _now()

    bit = await db.scalar(select(BrandInviteToken).where(BrandInviteToken.token == token))
    if bit is None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "Invalid or expired invite link.",
            status_code=400,
        )
    if bit.used_at is not None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "This invite link has already been used.",
            status_code=400,
        )
    if bit.expires_at < now:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "Invite link has expired. Contact support for a new one.",
            status_code=400,
        )

    user = await db.get(User, bit.user_id)
    if user is None:
        raise BuzzAPIException(errors.NOT_FOUND, "User not found.", status_code=404)

    brand = await db.get(Brand, bit.brand_id)
    if brand is None or brand.status != BrandStatus.APPROVED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Brand is not in an approved state.",
            status_code=400,
        )

    bit.used_at = now
    user.password_hash = hash_password(password)
    user.status = OrgUserStatus.ACTIVE.value
    await db.flush()

    return UserResponse(
        id=user.id,
        portal_role=user.portal_role,
        status=user.status,
        instagram_username=user.instagram_username,
        email=brand.company_email,
    )


async def login_brand(db: AsyncSession, email: str, password: str) -> tuple[User, UserResponse]:
    """Authenticate a brand by company email + password.

    Returns (user, user_response) so the route layer can issue tokens.
    """
    # Case-insensitive match: stored company_email casing isn't normalized at
    # creation, so compare on lower() to keep login from being case-sensitive.
    normalized = email.strip().lower()
    brand = await db.scalar(select(Brand).where(func.lower(Brand.company_email) == normalized))
    user = await db.get(User, brand.user_id) if brand is not None else None
    if brand is None or user is None:
        # Equalize timing with the wrong-password branch so a missing email
        # can't be distinguished from a valid one by response latency.
        verify_password(password, _DUMMY_HASH)
        raise BuzzAPIException(
            errors.UNAUTHORIZED,
            "Invalid email or password.",
            status_code=401,
        )

    if brand.status != BrandStatus.APPROVED.value:
        raise BuzzAPIException(
            errors.UNAUTHORIZED,
            "This brand account has not been approved yet.",
            status_code=401,
        )

    if user.status != OrgUserStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.UNAUTHORIZED,
            "Account setup is not complete. Use your invite link to set a password.",
            status_code=401,
        )

    if not user.password_hash:
        raise BuzzAPIException(
            errors.UNAUTHORIZED,
            "Account setup is not complete. Use your invite link to set a password.",
            status_code=401,
        )

    if not verify_password(password, user.password_hash):
        raise BuzzAPIException(
            errors.UNAUTHORIZED,
            "Invalid email or password.",
            status_code=401,
        )

    user.last_login_at = _now()
    await db.flush()

    resp = UserResponse(
        id=user.id,
        portal_role=user.portal_role,
        status=user.status,
        instagram_username=user.instagram_username,
        email=brand.company_email,
    )
    return user, resp
