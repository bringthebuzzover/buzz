"""Org onboarding orchestration (architecture §3.3, §3.4).

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.schemas.onboarding import OrgOnboardingRequest
from app.services.email import send_verification_email
from app.services.instagram import require_instagram_handle


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def _release_unverified_edu_claim(
    db: AsyncSession,
    *,
    claimant_id: uuid.UUID,
    edu_email: str,
) -> None:
    """Raise EDU_EMAIL_TAKEN or clear an abandoned unverified peer claim.

    Verified addresses are never released. Unverified peers younger than
    ``EDU_EMAIL_UNVERIFIED_CLAIM_TTL_HOURS`` still block; older claims are
    cleared so a typo / abandoned signup cannot permanently lock the address.
    """
    existing = await db.scalar(
        select(User).where(User.edu_email == edu_email, User.id != claimant_id)
    )
    if existing is None:
        return

    if existing.email_verified_at is not None:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "This .edu email is already associated with another account.",
            status_code=409,
        )

    org = await db.scalar(select(Organization).where(Organization.user_id == existing.id))
    claim_at = _as_utc(org.created_at if org is not None else existing.created_at)
    age = _now() - claim_at
    if age < timedelta(hours=settings.EDU_EMAIL_UNVERIFIED_CLAIM_TTL_HOURS):
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "This .edu email is already associated with another account.",
            status_code=409,
        )

    existing.edu_email = None
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == existing.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .values(expires_at=_now())
    )
    await db.flush()


async def _invalidate_verification_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Expire unused verification tokens so old inbox links stop working."""
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.used_at.is_(None),
        )
        .values(expires_at=_now())
    )


async def _mint_and_send_verification(
    db: AsyncSession,
    user: User,
    edu_email: str,
    *,
    org_name: str = "",
) -> bool:
    """Mint a live verification token and attempt delivery.

    Returns whether the provider accepted the send (or development console
    success). On failure the just-minted token is deleted so it does not burn
    a max-3 slot.
    """
    token = secrets.token_urlsafe(48)
    evt = EmailVerificationToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token=token,
        email=edu_email,
        expires_at=_now() + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    )
    db.add(evt)
    await db.flush()
    ok = await send_verification_email(edu_email, token, org_name=org_name)
    if not ok:
        await db.delete(evt)
        await db.flush()
    return ok


async def submit_org_onboarding(
    db: AsyncSession,
    user: User,
    payload: OrgOnboardingRequest,
) -> dict[str, Any]:
    """Phase 2: create org profile, advance to email verification.

    Guards:
    - User must be org role + pending_org_profile status.
    - edu_email must not already be verified by another user (unverified
      claims older than the TTL may be taken over).
    """
    if user.portal_role != PortalRole.ORG.value:
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

    await _release_unverified_edu_claim(db, claimant_id=user.id, edu_email=payload.edu_email)

    # Require OAuth username (org identity) before creating the profile row.
    require_instagram_handle(user.instagram_username)

    org = Organization(
        id=uuid.uuid4(),
        user_id=user.id,
        org_name=payload.org_name,
        university=payload.university,
        tiktok_handle=payload.tiktok_handle,
        follower_count=payload.follower_count,
        member_count=payload.member_count,
        category=payload.category.value if payload.category is not None else None,
        city=payload.city,
        state=payload.state,
        contact_name=payload.contact_name,
        delivery_address=payload.delivery_address,
    )
    db.add(org)

    user.edu_email = payload.edu_email
    user.status = OrgUserStatus.PENDING_EMAIL_VERIFICATION.value

    # The SELECTs above narrow the common cases, but two concurrent submits can
    # still race past them. Map each unique violation to its own typed error
    # rather than blanket-labelling everything "edu email taken": a duplicate
    # edu_email → 409 EDU_EMAIL_TAKEN; a duplicate organizations.user_id (same
    # user double-submitting) → the profile was already created → 400.
    try:
        await db.flush()
    except IntegrityError as exc:
        detail = str(exc.orig).lower()
        if "edu_email" in detail:
            raise BuzzAPIException(
                errors.EDU_EMAIL_TAKEN,
                "This .edu email is already associated with another account.",
                status_code=409,
            ) from exc
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Profile has already been submitted.",
            status_code=400,
        ) from exc

    email_sent = await _mint_and_send_verification(
        db, user, payload.edu_email, org_name=payload.org_name
    )

    return {
        "org_id": str(org.id),
        "status": user.status,
        "email_sent_to": payload.edu_email,
        "email_sent": email_sent,
    }


async def change_edu_email(db: AsyncSession, user: User, edu_email: str) -> dict[str, Any]:
    """Correct the .edu address while still awaiting verification."""
    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Only organization users verify a .edu email.",
            status_code=400,
        )
    if user.status != OrgUserStatus.PENDING_EMAIL_VERIFICATION.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Account is not awaiting email verification.",
            status_code=400,
        )

    if user.edu_email == edu_email:
        # Same address — behave like a resend rather than a no-op conflict.
        return await resend_verification_email(db, user)

    await _release_unverified_edu_claim(db, claimant_id=user.id, edu_email=edu_email)

    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization profile is missing.",
            status_code=400,
        )

    user.edu_email = edu_email
    await _invalidate_verification_tokens(db, user.id)

    try:
        await db.flush()
    except IntegrityError as exc:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "This .edu email is already associated with another account.",
            status_code=409,
        ) from exc

    ok = await _mint_and_send_verification(db, user, edu_email, org_name=org.org_name)
    if not ok:
        raise BuzzAPIException(
            errors.EMAIL_SEND_FAILED,
            "We could not send the verification email. Please try again.",
            status_code=502,
        )
    return {"email_sent_to": edu_email, "status": user.status}


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
            errors.VERIFICATION_TOKEN_INVALID,
            "Invalid verification token.",
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
    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Only organization users verify a .edu email.",
            status_code=400,
        )
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

    ok = await _mint_and_send_verification(db, user, user.edu_email)
    if not ok:
        raise BuzzAPIException(
            errors.EMAIL_SEND_FAILED,
            "We could not send the verification email. Please try again.",
            status_code=502,
        )

    return {"email_sent_to": user.edu_email}
