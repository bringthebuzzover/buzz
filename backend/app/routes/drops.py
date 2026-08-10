"""Drops routes — ``/api/drops`` (architecture.md §5.1, §7.1).

Stage 4 shipped the org browse feed (read). Stage 5A adds the org write/journey
paths: drop detail, apply, and notify-me set/delete.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.auth import CurrentOrg
from app.deps.db import get_db
from app.response import APIResponse, DataResponse, api_response
from app.schemas.drops import DropApplyRequest, DropDetailResponse, DropFeedItem, NotifyRequest
from app.services.drops import (
    apply_to_drop,
    build_application_response,
    build_drop_detail,
    clear_notify,
    get_drop_or_404,
    list_org_drop_feed,
    set_notify,
)

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
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Org-facing drop detail."""

    drop = await get_drop_or_404(db, drop_id)
    return api_response(data=await build_drop_detail(db, user, drop))


@router.post("/{drop_id}/apply", response_model=APIResponse)
async def apply_drop(
    drop_id: uuid.UUID,
    payload: DropApplyRequest,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Apply to a drop (``DROP_NOT_OPEN`` / ``ALREADY_APPLIED`` / ``CAPACITY_EXCEEDED``)."""

    application = await apply_to_drop(db, user, drop_id, payload.pitch)
    return api_response(data=await build_application_response(db, application))


@router.post("/{drop_id}/notify", response_model=APIResponse)
async def set_drop_notify(
    drop_id: uuid.UUID,
    payload: NotifyRequest,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Set/replace the caller org's reminder for a drop."""

    await set_notify(db, user, drop_id, payload.reminder_minutes)
    return api_response(data={"ok": True})


@router.delete("/{drop_id}/notify", response_model=APIResponse)
async def clear_drop_notify(
    drop_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Remove the caller org's reminder for a drop (idempotent)."""

    await clear_notify(db, user, drop_id)
    return api_response(data={"ok": True})
