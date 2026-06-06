"""Org onboarding orchestration (architecture §3.3, §3.4).

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus
from app.models.organization import Organization
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.schemas.onboarding import OrgOnboardingRequest
from app.services.email import send_verification_email


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def submit_org_onboarding(
    db: AsyncSession,
    user: User,
    payload: OrgOnboardingRequest,
) -> dict[str, Any]:
    """Phase 2: create org profile, advance to email verification.

    Guards:
    - User must be org role + pending_org_profile status.
    - edu_email must not already be verified by another user.
    """
    if user.portal_role != "org":
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Only organization users can submit onboarding.",
            status_code=400,
        )
    if user.status != OrgUserStatus.PENDING_ORG_PROFILE.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Profile has already been submitted.",
            status_code=400,
        )

    # Check for duplicate .edu email (unique constraint across users).
    existing = await db.scalar(
        select(User).where(User.edu_email == payload.edu_email, User.id != user.id)
    )
    if existing is not None:
        raise BuzzAPIException(
            errors.EMAIL_ALREADY_VERIFIED,
            "This .edu email is already associated with another account.",
            status_code=409,
        )

    org = Organization(
        id=uuid.uuid4(),
        user_id=user.id,
        org_name=payload.org_name,
        university=payload.university,
        edu_email=payload.edu_email,
        instagram_handle=payload.instagram_handle,
        tiktok_handle=payload.tiktok_handle,
        follower_count=payload.follower_count,
        member_count=payload.member_count,
        city=payload.city,
        state=payload.state,
        contact_name=payload.contact_name,
        delivery_address=payload.delivery_address,
    )
    db.add(org)

    user.edu_email = payload.edu_email
    user.status = OrgUserStatus.PENDING_EMAIL_VERIFICATION.value

    token = secrets.token_urlsafe(48)
    now = _now()
    evt = EmailVerificationToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token=token,
        email=payload.edu_email,
        expires_at=now + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    )
    db.add(evt)

    # The SELECT above narrows the common case, but two concurrent submits can
    # still race past it — the unique constraint on users.edu_email is the real
    # guard. Translate its IntegrityError into the same typed 409.
    try:
        await db.flush()
    except IntegrityError as exc:
        raise BuzzAPIException(
            errors.EMAIL_ALREADY_VERIFIED,
            "This .edu email is already associated with another account.",
            status_code=409,
        ) from exc

    await send_verification_email(payload.edu_email, token, org_name=payload.org_name)

    return {
        "org_id": str(org.id),
        "status": user.status,
        "email_sent_to": payload.edu_email,
    }


async def verify_email(db: AsyncSession, token: str) -> dict[str, Any]:
    """Phase 3: verify .edu email with a one-time token.

    On success: sets user.status=pending_approval, marks token used.
    """
    now = _now()

    # FOR UPDATE locks the token row so two concurrent redemptions (double-click)
    # serialize: the second waits, then sees used_at already set and is rejected.
    evt = await db.scalar(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.token == token)
        .with_for_update()
    )
    if evt is None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "Invalid or expired verification token.",
            status_code=400,
        )
    if evt.used_at is not None:
        raise BuzzAPIException(
            errors.EMAIL_ALREADY_VERIFIED,
            "This email has already been verified.",
            status_code=400,
        )
    if evt.expires_at < now:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "Verification token has expired. Request a new one.",
            status_code=400,
        )

    user = await db.get(User, evt.user_id)
    if user is None:
        raise BuzzAPIException(
            errors.NOT_FOUND,
            "User not found.",
            status_code=404,
        )

    if user.status != OrgUserStatus.PENDING_EMAIL_VERIFICATION.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Email has already been verified or account is not in the right state.",
            status_code=400,
        )

    evt.used_at = now
    user.status = OrgUserStatus.PENDING_APPROVAL.value
    user.email_verified_at = now
    await db.flush()

    return {"status": user.status}


async def resend_verification_email(db: AsyncSession, user: User) -> dict[str, Any]:
    """Re-send the verification email (max 3 active tokens at a time)."""
    if user.status != OrgUserStatus.PENDING_EMAIL_VERIFICATION.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Account is not awaiting email verification.",
            status_code=400,
        )
    if not user.edu_email:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "No .edu email on file.",
            status_code=400,
        )

    # Rate limit: count unused, unexpired tokens for this user.
    now = _now()
    unused = await db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at == None,  # noqa: E711
            EmailVerificationToken.expires_at > now,
        )
    )
    active_count = len(list(unused))
    if active_count >= 3:
        raise BuzzAPIException(
            errors.MAX_VERIFICATION_ATTEMPTS,
            "Too many verification emails. Wait for previous tokens to expire.",
            status_code=429,
        )

    token = secrets.token_urlsafe(48)
    evt = EmailVerificationToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token=token,
        email=user.edu_email,
        expires_at=now + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    )
    db.add(evt)
    await db.flush()

    await send_verification_email(user.edu_email, token)

    return {"email_sent_to": user.edu_email}
