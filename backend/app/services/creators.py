"""Creator apply, email confirm, and admin review.

Status lives on ``creators``. ``users.status`` stays ``active`` so the org
``pending_instagram`` machine never sees these rows. No feed session is
issued here.
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
from app.models.creator import Creator
from app.models.enums import CreatorStatus, OrgUserStatus, PortalRole
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.schemas.creators import CreatorApplyRequest
from app.security.one_shot_tokens import hash_token
from app.services.email import send_verification_email
from app.services.instagram import canonical_instagram_handle


def _now() -> datetime:
    return datetime.now(timezone.utc)


def feed_allowed(creator: Creator) -> bool:
    return creator.status == CreatorStatus.ACTIVE.value


async def _creator_email_taken(db: AsyncSession, edu_email: str) -> bool:
    existing = await db.scalar(
        select(User.id).where(
            User.portal_role == PortalRole.CREATOR.value,
            func.lower(User.edu_email) == edu_email,
        )
    )
    return existing is not None


async def apply_creator(db: AsyncSession, payload: CreatorApplyRequest) -> dict[str, object]:
    """Create a creator user in ``pending_email`` and send the verify link."""
    if await _creator_email_taken(db, payload.edu_email):
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "This .edu email is already associated with another creator account.",
            status_code=409,
        )
    handle = canonical_instagram_handle(payload.claimed_handle)
    if not handle:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Enter an Instagram username.",
            status_code=400,
        )

    user = User(
        id=uuid.uuid4(),
        portal_role=PortalRole.CREATOR.value,
        status=OrgUserStatus.ACTIVE.value,
        edu_email=payload.edu_email,
    )
    creator = Creator(
        id=uuid.uuid4(),
        user_id=user.id,
        name=payload.name,
        school=payload.school,
        city=payload.city,
        grad_year=payload.grad_year,
        niches=list(payload.niches),
        bio=payload.bio,
        claimed_instagram_username=handle,
        tiktok_handle=canonical_instagram_handle(payload.tiktok_handle) or "",
        open_to=list(payload.open_to),
        status=CreatorStatus.PENDING_EMAIL.value,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "This .edu email is already associated with another creator account.",
            status_code=409,
        ) from exc
    db.add(creator)
    await db.flush()

    raw = secrets.token_urlsafe(48)
    token = EmailVerificationToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw),
        email=payload.edu_email,
        expires_at=_now() + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    )
    db.add(token)
    await db.flush()
    sent = await send_verification_email(
        payload.edu_email,
        raw,
        org_name=payload.name,
        kind="creator",
    )
    if not sent:
        await db.delete(token)
        await db.flush()
        raise BuzzAPIException(
            errors.EMAIL_SEND_FAILED,
            "We could not send the verification email. Please try again.",
            status_code=502,
        )
    return {
        "creator_id": str(creator.id),
        "status": creator.status,
        "email_sent_to": payload.edu_email,
        "email_sent": True,
    }


async def confirm_creator_email(db: AsyncSession, token: str) -> dict[str, str]:
    """Consume a creator verify link. Does not mint a feed session."""
    now = _now()
    row = await db.scalar(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.token_hash == hash_token(token))
        .with_for_update()
    )
    if row is None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_INVALID,
            "Invalid verification token.",
            status_code=400,
        )
    if row.used_at is not None:
        raise BuzzAPIException(
            errors.EMAIL_ALREADY_VERIFIED,
            "This email has already been verified.",
            status_code=400,
        )
    if row.expires_at < now:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "Verification token has expired. Request a new one.",
            status_code=400,
        )

    user = await db.get(User, row.user_id)
    creator = None
    if user is not None and user.portal_role == PortalRole.CREATOR.value:
        creator = await db.scalar(select(Creator).where(Creator.user_id == user.id))
    if user is None or creator is None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This verification link is not for a creator account.",
            status_code=400,
        )
    if creator.status != CreatorStatus.PENDING_EMAIL.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Email has already been verified or account is not in the right state.",
            status_code=400,
        )

    row.used_at = now
    user.email_verified_at = now
    creator.status = CreatorStatus.PENDING_REVIEW.value
    await db.flush()
    return {"creator_id": str(creator.id), "status": creator.status}


async def _creator_or_404(db: AsyncSession, creator_id: uuid.UUID) -> Creator:
    creator = await db.get(Creator, creator_id)
    if creator is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Creator not found.", status_code=404)
    return creator


async def approve_creator(db: AsyncSession, creator_id: uuid.UUID) -> dict[str, str]:
    creator = await _creator_or_404(db, creator_id)
    if creator.status != CreatorStatus.PENDING_REVIEW.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Creator is not waiting for review.",
            status_code=400,
        )
    creator.status = CreatorStatus.PENDING_INSTAGRAM.value
    await db.flush()
    return {"creator_id": str(creator.id), "status": creator.status}


async def deny_creator(db: AsyncSession, creator_id: uuid.UUID) -> dict[str, str]:
    creator = await _creator_or_404(db, creator_id)
    if creator.status != CreatorStatus.PENDING_REVIEW.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Creator is not waiting for review.",
            status_code=400,
        )
    creator.status = CreatorStatus.DENIED.value
    user = await db.get(User, creator.user_id)
    if user is not None:
        user.token_version = (user.token_version or 0) + 1
    await db.flush()
    return {"creator_id": str(creator.id), "status": creator.status}


async def creator_for_user(db: AsyncSession, user: User) -> Creator:
    if user.portal_role != PortalRole.CREATOR.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Your account role cannot access this resource.",
            status_code=403,
        )
    creator = await db.scalar(select(Creator).where(Creator.user_id == user.id))
    if creator is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Creator not found.", status_code=404)
    return creator
