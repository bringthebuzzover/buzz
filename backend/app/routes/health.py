"""Public liveness endpoint.

Returns the standard envelope so CI / uptime checks and the Stage 1.2
smoke test all see the same shape every other endpoint uses.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.response import APIResponse, api_response

router = APIRouter(tags=["health"])


@router.get("/health", response_model=APIResponse)
async def get_health() -> APIResponse:
    """Liveness probe used by smoke tests and the CI envelope check."""

    return api_response(data={"status": "ok", "version": "0.1.0"})


@router.get("/config", response_model=APIResponse)
async def get_public_config() -> APIResponse:
    """Public, unauthenticated feature flags the SPA needs before login.

    Lets the brand-apply page hide itself when self-registration is disabled.
    """

    return api_response(
        data={"brandSelfRegistrationEnabled": settings.BRAND_SELF_REGISTRATION_ENABLED}
    )
