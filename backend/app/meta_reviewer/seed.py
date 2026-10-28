"""Idempotent reviewer org + accepted test-drop seat.

Not run on import. Operators call ``POST /api/meta-reviewer/seed`` (admin)
or ``python -m app.meta_reviewer.cli seed``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import TypedDict

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.meta_reviewer.gate import REVIEWER_ORG_NAME, require_reviewer_access, reviewer_org_email
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.drop_apply_intent import DropApplyIntent
from app.models.enums import ApplicationDecision, OrgUserStatus, PortalRole
from app.models.notify_me import NotifyMe
from app.models.org_connect_token import OrgConnectToken
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User
from app.models.verification_token import EmailVerificationToken

logger = logging.getLogger(__name__)


class ReviewerSeedResult(TypedDict):
    user_id: uuid.UUID
    org_id: uuid.UUID
    drop_id: uuid.UUID
    application_id: uuid.UUID
    created_user: bool
    created_application: bool


class ReviewerSetupStatus(TypedDict):
    enabled: bool
    seeded: bool
    org_id: uuid.UUID | None
    user_id: uuid.UUID | None
    drop_id: uuid.UUID | None


def parse_reviewer_drop_id() -> uuid.UUID | None:
    """Configured drop UUID, or None when it is unset or not a UUID."""

    raw = (settings.META_REVIEWER_DROP_ID or "").strip()
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


def reviewer_drop_id() -> uuid.UUID:
    parsed = parse_reviewer_drop_id()
    if parsed is None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Reviewer drop is not configured.",
            status_code=400,
        )
    return parsed


async def _reviewer_user(db: AsyncSession) -> User | None:
    found: User | None = await db.scalar(select(User).where(User.edu_email == reviewer_org_email()))
    return found


async def _ready_reviewer(db: AsyncSession) -> tuple[User, Organization] | None:
    user = await _reviewer_user(db)
    org = None
    if user is not None and user.portal_role == PortalRole.ORG.value:
        org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if (
        user is None
        or org is None
        or org.org_name != REVIEWER_ORG_NAME
        or user.status != OrgUserStatus.ACTIVE.value
    ):
        return None
    return user, org


async def load_ready_reviewer(db: AsyncSession) -> tuple[User, Organization]:
    """Active reviewer user + org, or 400 when seed has not been run."""

    pair = await _ready_reviewer(db)
    if pair is None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Reviewer organization is not set up.",
            status_code=400,
        )
    return pair


async def reviewer_setup_status(db: AsyncSession) -> ReviewerSetupStatus:
    """Read-only snapshot for the admin card. Does not create rows or read the link secret."""

    require_reviewer_access()
    pair = await _ready_reviewer(db)
    return {
        "enabled": True,
        "seeded": pair is not None,
        "org_id": pair[1].id if pair else None,
        "user_id": pair[0].id if pair else None,
        "drop_id": parse_reviewer_drop_id(),
    }


async def seed_reviewer_org(db: AsyncSession) -> ReviewerSeedResult:
    """Create or refresh the reviewer org and accept it on the configured drop.

    Refuses to take over an email that already belongs to a different org.
    Does not create the drop. Does not log secrets.
    """

    require_reviewer_access()
    drop_id = reviewer_drop_id()
    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Configured reviewer drop was not found.",
            status_code=400,
        )

    now = datetime.now(timezone.utc)
    email = reviewer_org_email()
    created_user = False
    user = await _reviewer_user(db)
    if user is None:
        user = User(
            id=uuid.uuid4(),
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.ACTIVE.value,
            edu_email=email,
            email_verified_at=now,
            instagram_username=None,
        )
        db.add(user)
        await db.flush()
        created_user = True
    elif user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "Reviewer email is already used by a non-org account.",
            status_code=409,
        )

    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is None:
        org = Organization(
            id=uuid.uuid4(),
            user_id=user.id,
            org_name=REVIEWER_ORG_NAME,
            university=REVIEWER_ORG_NAME,
            contact_name="Meta Reviewer",
            approved_at=now,
            instagram_handle_confirmed=False,
        )
        db.add(org)
        await db.flush()
    elif org.org_name != REVIEWER_ORG_NAME:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "Reviewer email is already used by another organization.",
            status_code=409,
        )

    user.status = OrgUserStatus.ACTIVE.value
    user.edu_email = email
    if user.email_verified_at is None:
        user.email_verified_at = now
    if org.approved_at is None:
        org.approved_at = now

    created_application = False
    application = await db.scalar(
        select(DropApplication).where(
            DropApplication.drop_id == drop.id,
            DropApplication.org_id == org.id,
            DropApplication.decision != ApplicationDecision.DENIED.value,
        )
    )
    if application is None:
        application = DropApplication(
            id=uuid.uuid4(),
            drop_id=drop.id,
            org_id=org.id,
            decision=ApplicationDecision.ACCEPTED.value,
            decision_at=now,
            allocated_units=1 if drop.total_product_units is not None else None,
        )
        db.add(application)
        created_application = True
    elif application.decision != ApplicationDecision.ACCEPTED.value:
        application.decision = ApplicationDecision.ACCEPTED.value
        application.decision_at = now
        created_application = True
    if drop.total_product_units is not None and application.allocated_units is None:
        application.allocated_units = 1

    await db.flush()
    logger.info(
        "meta reviewer seed user_id=%s org_id=%s drop_id=%s created_user=%s",
        user.id,
        org.id,
        drop.id,
        created_user,
    )
    return {
        "user_id": user.id,
        "org_id": org.id,
        "drop_id": drop.id,
        "application_id": application.id,
        "created_user": created_user,
        "created_application": created_application,
    }


async def _clear_org_posts(db: AsyncSession, org_id: uuid.UUID) -> None:
    post_ids = select(SocialPost.id).where(SocialPost.org_id == org_id)
    await db.execute(
        delete(PostCampaignSuggestion).where(PostCampaignSuggestion.post_id.in_(post_ids))
    )
    await db.execute(delete(PostCampaignLink).where(PostCampaignLink.post_id.in_(post_ids)))
    await db.execute(delete(SocialPost).where(SocialPost.org_id == org_id))


async def purge_reviewer_org(db: AsyncSession) -> bool:
    """Delete the reviewer user, org, and dependent rows. Does not delete the drop.

    Refuses when the configured email belongs to an org with a different name.
    Works with the flag off so cleanup does not require turning the path back on.
    Returns True when a user row was deleted.
    """

    email = reviewer_org_email()
    user = await db.scalar(select(User).where(User.edu_email == email))
    if user is None:
        return False
    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "Refusing to delete a non-org account at the reviewer email.",
            status_code=409,
        )
    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is not None and org.org_name != REVIEWER_ORG_NAME:
        raise BuzzAPIException(
            errors.EDU_EMAIL_TAKEN,
            "Refusing to delete an organization that is not the reviewer org.",
            status_code=409,
        )

    if org is not None:
        app_ids = select(DropApplication.id).where(DropApplication.org_id == org.id)
        await _clear_org_posts(db, org.id)
        await db.execute(
            delete(PostCampaignSuggestion).where(PostCampaignSuggestion.application_id.in_(app_ids))
        )
        await db.execute(
            delete(PostCampaignLink).where(PostCampaignLink.application_id.in_(app_ids))
        )
        await db.execute(delete(NotifyMe).where(NotifyMe.org_id == org.id))
        await db.execute(delete(DropApplyIntent).where(DropApplyIntent.org_id == org.id))
        await db.execute(delete(OrgIgChangeRequest).where(OrgIgChangeRequest.org_id == org.id))
        await db.execute(delete(OrgConnectToken).where(OrgConnectToken.org_id == org.id))
        await db.execute(delete(DropApplication).where(DropApplication.org_id == org.id))
        await db.execute(delete(Organization).where(Organization.id == org.id))

    await db.execute(delete(OrgConnectToken).where(OrgConnectToken.user_id == user.id))
    await db.execute(delete(OrgIgChangeRequest).where(OrgIgChangeRequest.user_id == user.id))
    await db.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    )
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.flush()
    logger.info("meta reviewer purge user_id=%s", user.id)
    return True
