"""Org onboarding orchestration (architecture §3.3, §3.4).

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

import logging
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
from app.security.one_shot_tokens import hash_token
from app.security.token_crypto import TokenDecryptionError, decrypt_token
from app.services.email import send_verification_email
from app.services.instagram import InstagramClient, require_instagram_handle
from app.services.instagram_token import clear_unusable_instagram_token

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


_ROTATE_ELIGIBLE_STATUSES = frozenset(
    {
        OrgUserStatus.ACTIVE.value,
        OrgUserStatus.PENDING_APPROVAL.value,
    }
)


async def _assert_pending_edu_available(
    db: AsyncSession,
    *,
    claimant_id: uuid.UUID,
    edu_email: str,
) -> None:
    """Block addresses already latched as another user's pending rotate."""
    pending_owner = await db.scalar(
        select(User).where(
            User.pending_edu_email == edu_email,
            User.id != claimant_id,
        )
    )
    if pending_owner is not None:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "This .edu email is already associated with another account.",
            status_code=409,
        )


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
    Pending-swap latches on other users also block (no TTL release).
    """
    await _assert_pending_edu_available(db, claimant_id=claimant_id, edu_email=edu_email)

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
    existing.pending_edu_email = None
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == existing.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .values(expires_at=_now())
    )
    await db.flush()


async def _count_active_verification_tokens(db: AsyncSession, user_id: uuid.UUID) -> int:
    now = _now()
    unused = await db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.used_at == None,  # noqa: E711
            EmailVerificationToken.expires_at > now,
        )
    )
    return len(list(unused))


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
    raw = secrets.token_urlsafe(48)
    evt = EmailVerificationToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw),
        email=edu_email,
        expires_at=_now() + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    )
    db.add(evt)
    await db.flush()
    ok = await send_verification_email(edu_email, raw, org_name=org_name)
    if not ok:
        await db.delete(evt)
        await db.flush()
    return ok


async def _seed_follower_count_from_graph(
    org: Organization,
    user: User,
    ig: InstagramClient,
) -> None:
    """Best-effort Graph followers write after org create. Never raises."""
    now = _now()
    if not user.instagram_access_token:
        logger.warning(
            "onboarding followers_seed_failed org_id=%s user_id=%s reason=missing_token",
            org.id,
            user.id,
        )
        return
    exp = user.instagram_token_expires_at
    if exp is not None:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp <= now:
            logger.warning(
                "onboarding followers_seed_failed org_id=%s user_id=%s reason=expired_token",
                org.id,
                user.id,
            )
            return
    try:
        token = decrypt_token(user.instagram_access_token)
    except TokenDecryptionError:
        clear_unusable_instagram_token(user)
        logger.warning(
            "onboarding followers_seed_failed org_id=%s user_id=%s reason=decrypt_error",
            org.id,
            user.id,
        )
        return
    except Exception:  # noqa: BLE001
        logger.warning(
            "onboarding followers_seed_failed org_id=%s user_id=%s reason=decrypt_error",
            org.id,
            user.id,
        )
        return
    try:
        profile = await ig.fetch_profile(token)
    except Exception:  # noqa: BLE001
        logger.warning(
            "onboarding followers_seed_failed org_id=%s user_id=%s reason=fetch_error",
            org.id,
            user.id,
        )
        return
    if profile.followers_count is None:
        logger.warning(
            "onboarding followers_seed_failed org_id=%s user_id=%s reason=omitted",
            org.id,
            user.id,
        )
        return
    org.follower_count = profile.followers_count


async def submit_org_onboarding(
    db: AsyncSession,
    user: User,
    payload: OrgOnboardingRequest,
    ig: InstagramClient,
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
        follower_count=None,
        member_count=payload.member_count,
        category=payload.category.value,
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

    await _seed_follower_count_from_graph(org, user, ig)
    await db.flush()

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
    """Redeem a one-time .edu verification token.

    Onboarding (``pending_email_verification``): advance to ``pending_approval``.
    Pending-swap (active / pending_approval with ``pending_edu_email``): swap the
    live address, clear the latch, refresh ``email_verified_at``, keep status.
    """
    now = _now()

    # FOR UPDATE locks the token row so two concurrent redemptions (double-click)
    # serialize: the second waits, then sees used_at already set and is rejected.
    evt = await db.scalar(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.token_hash == hash_token(token))
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

    token_email = (evt.email or "").strip().lower()

    if (
        user.status in _ROTATE_ELIGIBLE_STATUSES
        and user.pending_edu_email
        and token_email == user.pending_edu_email
    ):
        evt.used_at = now
        user.edu_email = user.pending_edu_email
        user.pending_edu_email = None
        user.email_verified_at = now
        await db.flush()
        return {"status": user.status}

    if user.status != OrgUserStatus.PENDING_EMAIL_VERIFICATION.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Email has already been verified or account is not in the right state.",
            status_code=400,
        )

    evt.used_at = now
    user.status = OrgUserStatus.PENDING_APPROVAL.value
    user.email_verified_at = now
    user.pending_edu_email = None
    await db.flush()

    return {"status": user.status}


async def resend_verification_email(db: AsyncSession, user: User) -> dict[str, Any]:
    """Re-send verification (onboarding inbox or pending-swap latch)."""
    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Only organization users verify a .edu email.",
            status_code=400,
        )

    target: str | None = None
    org_name = ""
    if user.status == OrgUserStatus.PENDING_EMAIL_VERIFICATION.value:
        target = user.edu_email
    elif user.status in _ROTATE_ELIGIBLE_STATUSES and user.pending_edu_email:
        target = user.pending_edu_email
        org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
        if org is not None:
            org_name = org.org_name
    else:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Account is not awaiting email verification.",
            status_code=400,
        )

    if not target:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "No .edu email on file.",
            status_code=400,
        )

    if await _count_active_verification_tokens(db, user.id) >= 3:
        raise BuzzAPIException(
            errors.MAX_VERIFICATION_ATTEMPTS,
            "Too many verification emails. Wait for previous tokens to expire.",
            status_code=429,
        )

    ok = await _mint_and_send_verification(db, user, target, org_name=org_name)
    if not ok:
        raise BuzzAPIException(
            errors.EMAIL_SEND_FAILED,
            "We could not send the verification email. Please try again.",
            status_code=502,
        )

    return {"email_sent_to": target}


async def rotate_edu_email(db: AsyncSession, user: User, edu_email: str) -> dict[str, Any]:
    """Start a pending-swap rotate for an active or pending_approval org.

    Keeps the live ``edu_email`` until the new address is verified. Does not
    demote status or gate the portal.
    """
    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Only organization users verify a .edu email.",
            status_code=400,
        )
    if user.status not in _ROTATE_ELIGIBLE_STATUSES:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "School email can only be changed after verification.",
            status_code=400,
        )
    if not user.edu_email or user.email_verified_at is None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "School email can only be changed after verification.",
            status_code=400,
        )

    if user.edu_email == edu_email:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "That is already your verified school email.",
            status_code=400,
        )

    if user.pending_edu_email == edu_email:
        # Same pending address — behave like a resend.
        return {
            **(await resend_verification_email(db, user)),
            "pending_edu_email": edu_email,
            "status": user.status,
        }

    await _release_unverified_edu_claim(db, claimant_id=user.id, edu_email=edu_email)

    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization profile is missing.",
            status_code=400,
        )

    user.pending_edu_email = edu_email
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

    return {
        "email_sent_to": edu_email,
        "pending_edu_email": edu_email,
        "status": user.status,
    }


async def cancel_pending_edu_email(db: AsyncSession, user: User) -> dict[str, Any]:
    """Clear a pending-swap latch and invalidate unused verification tokens."""
    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Only organization users verify a .edu email.",
            status_code=400,
        )
    if user.status not in _ROTATE_ELIGIBLE_STATUSES:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "No pending school email change to cancel.",
            status_code=400,
        )
    if not user.pending_edu_email:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "No pending school email change to cancel.",
            status_code=400,
        )

    user.pending_edu_email = None
    await _invalidate_verification_tokens(db, user.id)
    await db.flush()
    return {"ok": True, "status": user.status}
