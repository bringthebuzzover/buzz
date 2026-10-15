"""Creator routes — ``/api/creators``."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.user import User
from app.response import APIResponse, DataResponse, api_response
from app.schemas.creators import (
    CreatorApplyRequest,
    CreatorApplyResponse,
    CreatorStatusResponse,
    CreatorVerifyRequest,
)
from app.security.rate_limit import rate_limited
from app.services.creators import (
    apply_creator,
    confirm_creator_email,
    creator_for_user,
    feed_allowed,
)

router = APIRouter(prefix="/creators", tags=["creators"])


@router.post(
    "/apply",
    response_model=DataResponse[CreatorApplyResponse],
    dependencies=[Depends(rate_limited("creator_apply", limit=5, window=60))],
)
async def creator_apply(
    payload: CreatorApplyRequest,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Public creator apply. Does not open a feed session."""
    result = await apply_creator(db, payload)
    return api_response(data=CreatorApplyResponse.model_validate(result))


@router.post(
    "/verify-email",
    response_model=DataResponse[CreatorStatusResponse],
)
async def creator_verify_email(
    payload: CreatorVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Confirm the campus email. Does not mint a feed session."""
    result = await confirm_creator_email(db, payload.token)
    return api_response(data=CreatorStatusResponse.model_validate(result))


@router.get("/feed")
async def creator_feed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Feed is empty until creator drops exist, and closed until status is active."""
    creator = await creator_for_user(db, user)
    if not feed_allowed(creator):
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Your creator account cannot open the feed.",
            status_code=403,
        )
    return api_response(data={"drops": []})
