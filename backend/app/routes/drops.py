"""Drops routes — ``/api/drops`` (architecture.md §5.1, §7.1).

Stage 4 shipped the org browse feed (read). Stage 5A adds the org write/journey
paths: drop detail, apply, and notify-me set/delete.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.deps.auth import CurrentOrg, get_current_user, get_current_user_optional
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.response import APIResponse, DataResponse, api_response
from app.schemas.acks import OkResponse
from app.schemas.drops import (
    ApplicationResponse,
    DropApplyRequest,
    DropDetailResponse,
    DropFeedItem,
    DropIntentPitchRequest,
    NotifyRequest,
)
from app.services.drop_apply_intents import (
    assert_intent_drop_public,
    build_public_drop_detail,
    record_drop_apply_intent,
)
from app.services.drops import (
    apply_to_drop,
    build_application_response,
    build_drop_detail,
    clear_notify,
    get_drop_or_404,
    list_org_drop_feed,
    set_notify,
)
from app.services.orgs import get_org_for_user

router = APIRouter(prefix="/drops", tags=["drops"])


@router.get("", response_model=DataResponse[list[DropFeedItem]])
async def list_drops(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
) -> APIResponse:
    """Org drop browse feed (JWT + ``org`` role + ``active``)."""

    items, total = await list_org_drop_feed(db, user, page=page, per_page=per_page)
    return api_response(
        data=items,
        meta={"page": page, "per_page": per_page, "total": total},
    )


@router.get("/{drop_id}", response_model=DataResponse[DropDetailResponse])
async def get_drop(
    drop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> APIResponse:
    """Org-facing drop detail, or public creative fields without a session."""

    if (
        user is not None
        and user.portal_role == PortalRole.ORG.value
        and user.status == OrgUserStatus.ACTIVE.value
    ):
        drop = await get_drop_or_404(db, drop_id)
        return api_response(data=await build_drop_detail(db, user, drop))

    drop = await assert_intent_drop_public(db, drop_id)
    org_id = None
    if user is not None and user.portal_role == PortalRole.ORG.value:
        org = await get_org_for_user(db, user)
        if org is not None:
            org_id = org.id
    return api_response(data=await build_public_drop_detail(db, drop, org_id=org_id))


@router.post("/{drop_id}/apply", response_model=DataResponse[ApplicationResponse])
async def apply_drop(
    drop_id: uuid.UUID,
    payload: DropApplyRequest,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Apply to a drop (``DROP_NOT_OPEN`` / ``ALREADY_APPLIED`` / ``CAPACITY_EXCEEDED``)."""

    application = await apply_to_drop(db, user, drop_id, payload.pitch)
    return api_response(data=await build_application_response(db, application))


@router.patch("/{drop_id}/intent", response_model=DataResponse[DropDetailResponse])
async def patch_drop_intent(
    drop_id: uuid.UUID,
    payload: DropIntentPitchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Pending org upserts pitch on a signup intent (not a real apply)."""

    if user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Your account role cannot access this resource.",
            status_code=403,
        )
    if user.status == OrgUserStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Active orgs apply with POST /api/drops/{id}/apply.",
            status_code=400,
        )
    org = await get_org_for_user(db, user)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization profile not found.", status_code=404)
    await record_drop_apply_intent(db, org_id=org.id, drop_id=drop_id, pitch=payload.pitch)
    drop = await assert_intent_drop_public(db, drop_id)
    return api_response(data=await build_public_drop_detail(db, drop, org_id=org.id))


@router.post("/{drop_id}/notify", response_model=DataResponse[OkResponse])
async def set_drop_notify(
    drop_id: uuid.UUID,
    payload: NotifyRequest,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Set/replace the caller org's reminder for a drop."""

    await set_notify(db, user, drop_id, payload.reminder_minutes)
    return api_response(data=OkResponse())


@router.delete("/{drop_id}/notify", response_model=DataResponse[OkResponse])
async def clear_drop_notify(
    drop_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Remove the caller org's reminder for a drop (idempotent)."""

    await clear_notify(db, user, drop_id)
    return api_response(data=OkResponse())
