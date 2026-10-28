"""Reviewer HTTP surface. Every handler 404s when the flag is off.

META-REVIEWER-PATH: mounted from ``app.main``. The link secret is accepted
only in the JSON body, never the query string, and is not logged.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.deps.auth import _load_user_from_bearer
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.meta_reviewer.gate import link_secret_matches, require_reviewer_access
from app.meta_reviewer.seed import load_ready_reviewer, seed_reviewer_org
from app.models.enums import OrgUserStatus, PortalRole
from app.response import APIResponse, DataResponse, api_response
from app.routes.auth import _set_state_cookie
from app.schemas.acks import InstagramBindStartResponse
from app.schemas.common import CamelModel
from app.security import jwt
from app.security.rate_limit import rate_limited
from app.services.instagram import InstagramClient, get_instagram_client

router = APIRouter(prefix="/meta-reviewer", tags=["meta-reviewer"])

_MAX_TOKEN_LEN = 256
_start_limit = rate_limited("meta_reviewer_start", limit=10, window=60)
_seed_limit = rate_limited("meta_reviewer_seed", limit=10, window=60)

_START_OPENAPI: dict[str, Any] = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["token"],
                    "properties": {
                        "token": {"type": "string", "minLength": 1, "maxLength": _MAX_TOKEN_LEN}
                    },
                }
            }
        },
    }
}


class MetaReviewerSeedResponse(CamelModel):
    user_id: str
    org_id: str
    drop_id: str
    application_id: str
    created_user: bool
    created_application: bool


async def _read_token(request: Request) -> str:
    """Parse ``{"token": "..."}`` without echoing the secret in a 422 body."""

    try:
        body = await request.json()
    except Exception as exc:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Request validation failed.",
            status_code=422,
        ) from exc
    if not isinstance(body, dict):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Request validation failed.",
            status_code=422,
        )
    token = body.get("token")
    if not isinstance(token, str) or not token.strip() or len(token) > _MAX_TOKEN_LEN:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Request validation failed.",
            status_code=422,
        )
    return token


@router.post(
    "/start",
    response_model=DataResponse[InstagramBindStartResponse],
    openapi_extra=_START_OPENAPI,
)
async def meta_reviewer_start(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    ig: InstagramClient = Depends(get_instagram_client),
) -> APIResponse:
    """Verify the reusable link secret and mint a reviewer OAuth state.

    The state cookie is the same CSRF binding as Connect. ``next`` is not
    taken from the client (no open redirect).
    """

    require_reviewer_access()
    await _start_limit(request)
    token = await _read_token(request)
    if not link_secret_matches(token):
        raise BuzzAPIException(
            errors.UNAUTHORIZED,
            "Invalid reviewer link.",
            status_code=401,
        )
    user, _org = await load_ready_reviewer(db)
    state = jwt.create_oauth_state_token(bind_user_id=user.id, reviewer=True)
    _set_state_cookie(response, state)
    return api_response(
        data=InstagramBindStartResponse(authorize_url=ig.build_authorize_url(state))
    )


@router.post("/seed", response_model=DataResponse[MetaReviewerSeedResponse])
async def meta_reviewer_seed(
    request: Request,
    db: AsyncSession = Depends(get_db),
    authorization: Annotated[str | None, Header()] = None,
) -> APIResponse:
    """Admin-only idempotent seed. 404 when the flag is off, before auth."""

    require_reviewer_access()
    await _seed_limit(request)
    user = await _load_user_from_bearer(authorization, db, request.method)
    if user.portal_role != PortalRole.ADMIN.value or user.status != OrgUserStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Admin access required.",
            status_code=403,
        )
    seeded = await seed_reviewer_org(db)
    return api_response(
        data=MetaReviewerSeedResponse(
            user_id=str(seeded["user_id"]),
            org_id=str(seeded["org_id"]),
            drop_id=str(seeded["drop_id"]),
            application_id=str(seeded["application_id"]),
            created_user=bool(seeded["created_user"]),
            created_application=bool(seeded["created_application"]),
        )
    )
