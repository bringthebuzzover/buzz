"""Standard API response envelope.

Every endpoint returns the same shape — `{ data, meta, error }` — so the
frontend's `api/client.ts` can branch uniformly on `error.code` for failures
and read `data`/`meta` for success (`architecture.md` §5.2).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Machine-readable error payload returned in `APIResponse.error`."""

    code: str
    message: str
    details: dict[str, Any] | None = None


class APIResponse(BaseModel):
    """Top-level envelope returned by every endpoint."""

    data: Any = None
    meta: dict[str, Any] | None = None
    error: ErrorDetail | None = None


def api_response(
    data: Any = None,
    meta: dict[str, Any] | None = None,
) -> APIResponse:
    """Build a success envelope. `error` is always `None` on success."""

    return APIResponse(data=data, meta=meta, error=None)


def api_error_response(
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> APIResponse:
    """Build an error envelope. `data` and `meta` are always `None`."""

    return APIResponse(
        data=None,
        meta=None,
        error=ErrorDetail(code=code, message=message, details=details),
    )
