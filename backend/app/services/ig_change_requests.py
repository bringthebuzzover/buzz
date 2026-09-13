"""Org Instagram identity change requests (PRODUCT §3.1.4).

Submit is a ticket. Approve is the identity write. Typed ``@`` is never a
Graph id. Account switch must clear Graph ids in the same commit as the
``pending_instagram`` demote, or returning login auto-promotes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, BrandTrackerStage, OrgUserStatus, PortalRole
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.social_post import SocialPost
from app.models.user import User
from app.security.session import bump_token_version, commit_revocation
from app.services.email import (
    send_org_ig_change_denied_email,
    send_org_ig_rename_approved_email,
    send_org_ig_switch_connect_email,
)
from app.services.instagram_token import clear_unusable_instagram_token
from app.services.org_apply import assert_handle_available, normalize_claimed_handle
from app.services.org_connect import create_org_connect_token

logger = logging.getLogger(__name__)

_KINDS = frozenset({"rename", "account_switch"})
_STATUSES = frozenset({"pending", "approved", "denied"})
_REASON_MIN = 10


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(row: OrgIgChangeRequest) -> dict[str, Any]:
    return {
        "id": row.id,
        "org_id": row.org_id,
        "user_id": row.user_id,
        "kind": row.kind,
        "current_handle": row.current_handle,
        "requested_handle": row.requested_handle,
        "reason": row.reason,
        "status": row.status,
        "decided_kind": row.decided_kind,
        "decided_at": row.decided_at,
        "created_at": row.created_at,
    }


async def _org_and_user(db: AsyncSession, user: User) -> tuple[Organization, User]:
    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)
    if user.status == OrgUserStatus.ERASED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization account has been erased.",
            status_code=409,
        )
    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization profile not found.", status_code=404)
    return org, user


async def latest_approved_switch(db: AsyncSession, org_id: UUID) -> OrgIgChangeRequest | None:
    return (
        await db.scalars(
            select(OrgIgChangeRequest)
            .where(
                OrgIgChangeRequest.org_id == org_id,
                OrgIgChangeRequest.status == "approved",
                OrgIgChangeRequest.decided_kind == "account_switch",
            )
            .order_by(OrgIgChangeRequest.decided_at.desc())
            .limit(1)
        )
    ).first()


async def get_request_state(db: AsyncSession, user: User) -> dict[str, Any]:
    org, _ = await _org_and_user(db, user)
    pending = await db.scalar(
        select(OrgIgChangeRequest).where(
            OrgIgChangeRequest.org_id == org.id,
            OrgIgChangeRequest.status == "pending",
        )
    )
    latest = await db.scalar(
        select(OrgIgChangeRequest)
        .where(OrgIgChangeRequest.org_id == org.id)
        .order_by(OrgIgChangeRequest.created_at.desc())
        .limit(1)
    )
    switch = await latest_approved_switch(db, org.id)
    return {
        "pending": _serialize(pending) if pending is not None else None,
        "latest": _serialize(latest) if latest is not None else None,
        "ig_switched_at": switch.decided_at if switch is not None else None,
        "previous_instagram_handle": switch.current_handle if switch is not None else None,
    }


async def submit_request(
    db: AsyncSession,
    user: User,
    *,
    kind: str,
    current_handle: str,
    requested_handle: str,
    reason: str,
) -> dict[str, Any]:
    if kind not in _KINDS:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Kind must be rename or account_switch.",
            status_code=400,
        )
    org, user = await _org_and_user(db, user)
    if user.status != OrgUserStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Only an active organization can request an Instagram identity change.",
            status_code=400,
        )

    stored = normalize_claimed_handle(user.instagram_username or "")
    typed_current = normalize_claimed_handle(current_handle)
    requested = normalize_claimed_handle(requested_handle)
    if typed_current.casefold() != stored.casefold():
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Confirmation does not match this organization's Instagram handle.",
            status_code=400,
        )
    if requested.casefold() == stored.casefold():
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Requested handle must be different from the current handle.",
            status_code=400,
        )
    cleaned_reason = reason.strip()
    if len(cleaned_reason) < _REASON_MIN:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Explain the change in at least {_REASON_MIN} characters.",
            status_code=400,
        )

    existing_pending = await db.scalar(
        select(OrgIgChangeRequest.id).where(
            OrgIgChangeRequest.org_id == org.id,
            OrgIgChangeRequest.status == "pending",
        )
    )
    if existing_pending is not None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This organization already has a pending Instagram identity request.",
            status_code=409,
        )

    await assert_handle_available(db, requested, exclude_user_id=user.id)

    row = OrgIgChangeRequest(
        id=uuid4(),
        org_id=org.id,
        user_id=user.id,
        kind=kind,
        current_handle=stored,
        requested_handle=requested,
        reason=cleaned_reason,
        status="pending",
    )
    db.add(row)
    await db.flush()
    logger.info("ig_change_request_submitted request_id=%s org_id=%s kind=%s", row.id, org.id, kind)
    return _serialize(row)


async def list_requests(db: AsyncSession, *, status: str | None = None) -> list[dict[str, Any]]:
    if status is not None and status not in _STATUSES:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Unknown request status: {status}.",
            status_code=400,
        )
    stmt = (
        select(OrgIgChangeRequest, Organization, User)
        .join(Organization, Organization.id == OrgIgChangeRequest.org_id)
        .join(User, User.id == OrgIgChangeRequest.user_id)
        .order_by(OrgIgChangeRequest.created_at.asc())
    )
    if status is not None:
        stmt = stmt.where(OrgIgChangeRequest.status == status)
    rows = list(await db.execute(stmt))
    return [
        {
            **_serialize(req),
            "org_name": org.org_name,
            "university": org.university,
        }
        for req, org, _user in rows
    ]


async def get_request(db: AsyncSession, request_id: UUID) -> dict[str, Any]:
    row = (
        await db.execute(
            select(OrgIgChangeRequest, Organization, User)
            .join(Organization, Organization.id == OrgIgChangeRequest.org_id)
            .join(User, User.id == OrgIgChangeRequest.user_id)
            .where(OrgIgChangeRequest.id == request_id)
        )
    ).first()
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Request not found.", status_code=404)
    req, org, user = row
    return {
        **_serialize(req),
        "org_name": org.org_name,
        "university": org.university,
        "edu_email": user.edu_email,
        "user_status": user.status,
        **(await _risk_context(db, org.id)),
    }


async def _risk_context(db: AsyncSession, org_id: UUID) -> dict[str, Any]:
    accepted = await db.scalar(
        select(func.count(DropApplication.id)).where(
            DropApplication.org_id == org_id,
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
        )
    )
    linked = await db.scalar(
        select(func.count(PostCampaignLink.id))
        .join(SocialPost, SocialPost.id == PostCampaignLink.post_id)
        .where(SocialPost.org_id == org_id)
    )
    live = await db.scalar(
        select(func.count(func.distinct(Drop.id)))
        .join(DropApplication, DropApplication.drop_id == Drop.id)
        .where(
            DropApplication.org_id == org_id,
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            Drop.hidden_at.is_(None),
            Drop.published_at.is_not(None),
            Drop.brand_tracker_stage != BrandTrackerStage.DROP_FINISHED.value,
        )
    )
    finished = await db.scalar(
        select(func.count(func.distinct(Drop.id)))
        .join(DropApplication, DropApplication.drop_id == Drop.id)
        .where(
            DropApplication.org_id == org_id,
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            Drop.brand_tracker_stage == BrandTrackerStage.DROP_FINISHED.value,
        )
    )
    return {
        "accepted_count": int(accepted or 0),
        "linked_post_count": int(linked or 0),
        "live_drop_count": int(live or 0),
        "finished_drop_count": int(finished or 0),
    }


async def approve_request(
    db: AsyncSession,
    request_id: UUID,
    *,
    kind: str,
    tester_invite_confirmed: bool = False,
) -> dict[str, Any]:
    if kind not in _KINDS:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Approve kind must be rename or account_switch.",
            status_code=400,
        )
    req = await db.get(OrgIgChangeRequest, request_id)
    if req is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Request not found.", status_code=404)
    if req.status != "pending":
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This request has already been decided.",
            status_code=400,
        )
    user = await db.get(User, req.user_id)
    org = await db.get(Organization, req.org_id)
    if user is None or org is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)
    if user.status == OrgUserStatus.ERASED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization account has been erased.",
            status_code=409,
        )
    if user.status != OrgUserStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization must be active to approve an Instagram identity change.",
            status_code=400,
        )

    if kind == "account_switch" and not tester_invite_confirmed:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Confirm you added the requested handle as an Instagram Tester "
            "before approving a switch.",
            status_code=400,
        )

    now = _now()
    req.status = "approved"
    req.decided_kind = kind
    req.decided_at = now
    email_sent = False

    if kind == "rename":
        await db.flush()
        email_sent = await send_org_ig_rename_approved_email(
            user.edu_email or "",
            org_name=org.org_name,
            requested_handle=req.requested_handle,
        )
    else:
        await assert_handle_available(db, req.requested_handle, exclude_user_id=user.id)
        clear_unusable_instagram_token(user, bump_session=False)
        user.instagram_user_id = None
        user.instagram_token_user_id = None
        user.instagram_username = req.requested_handle
        user.status = OrgUserStatus.PENDING_INSTAGRAM.value
        bump_token_version(user)
        connect_token = await create_org_connect_token(db, org, user)
        await db.flush()
        await commit_revocation(db)
        email_sent = await send_org_ig_switch_connect_email(
            user.edu_email or "",
            org_name=org.org_name,
            connect_token=connect_token,
            requested_handle=req.requested_handle,
        )

    logger.info(
        "ig_change_request_approved request_id=%s kind=%s email_sent=%s",
        req.id,
        kind,
        email_sent,
    )
    return {**_serialize(req), "email_sent": email_sent, "user_status": user.status}


async def deny_request(db: AsyncSession, request_id: UUID) -> dict[str, Any]:
    req = await db.get(OrgIgChangeRequest, request_id)
    if req is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Request not found.", status_code=404)
    if req.status != "pending":
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This request has already been decided.",
            status_code=400,
        )
    user = await db.get(User, req.user_id)
    org = await db.get(Organization, req.org_id)
    if user is None or org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)
    req.status = "denied"
    req.decided_at = _now()
    await db.flush()
    email_sent = await send_org_ig_change_denied_email(
        user.edu_email or "",
        org_name=org.org_name,
    )
    logger.info("ig_change_request_denied request_id=%s", req.id)
    return {**_serialize(req), "email_sent": email_sent}
