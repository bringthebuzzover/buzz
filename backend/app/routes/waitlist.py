"""Public waitlist route — ``POST /api/waitlist`` (architecture.md §9.2)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.db import get_db
from app.response import APIResponse, api_response
from app.schemas.waitlist import WaitlistSubmitRequest
from app.services.waitlist import submit_waitlist

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


@router.post("", response_model=APIResponse)
async def submit_waitlist_entry(
    payload: WaitlistSubmitRequest,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await submit_waitlist(
        db,
        submitter_name=payload.submitter_name,
        entity_name=payload.entity_name,
        email=payload.email,
        entity_type=payload.entity_type,
        details=payload.details,
    )
    return api_response(data=result)
