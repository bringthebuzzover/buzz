"""Public liveness endpoint.

Returns the standard envelope so CI / uptime checks and the Stage 1.2
smoke test all see the same shape every other endpoint uses. Also pings
the database so Railway / uptime monitors catch a dead Postgres.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.response import APIResponse, api_response

router = APIRouter(tags=["health"])


@router.get("/health", response_model=APIResponse)
async def get_health(db: AsyncSession = Depends(get_db)) -> APIResponse:
    """Liveness probe used by smoke tests and the CI envelope check.

    Returns 503 when Postgres is unreachable so Railway healthchecks fail
    closed rather than reporting a healthy API with a dead DB.
    """

    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 — any DB failure is unhealthy
        raise BuzzAPIException(
            errors.INTERNAL_ERROR,
            "Database unavailable.",
            status_code=503,
        ) from exc

    return api_response(data={"status": "ok", "version": "0.1.0"})


@router.get("/config", response_model=APIResponse)
async def get_public_config() -> APIResponse:
    """Public, unauthenticated feature flags the SPA needs before login.

    Lets the brand-apply page hide itself when self-registration is disabled.
    """

    return api_response(
        data={"brandSelfRegistrationEnabled": settings.BRAND_SELF_REGISTRATION_ENABLED}
    )
