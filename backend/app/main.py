"""FastAPI application entrypoint.

Wires the Stage 1 contract: CORS allowlist, the `{ data, meta, error }`
envelope via `BuzzAPIException` + unhandled-exception handlers, and the
liveness route. Docs are exposed under `/api/docs` and the spec at
`/api/openapi.json` so all backend surfaces share the same `/api` prefix.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import errors
from app.deps.db import engine
from app.exceptions import BuzzAPIException
from app.response import api_error_response
from app.routes.health import router as health_router

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://bringthebuzzover.com",
    "https://www.bringthebuzzover.com",
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Dispose the async engine cleanly on shutdown."""

    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(
    title="Buzz API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BuzzAPIException)
async def buzz_exception_handler(
    request: Request,
    exc: BuzzAPIException,
) -> JSONResponse:
    """Serialize typed domain failures as the standard error envelope."""

    payload = api_error_response(
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=payload.model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Last-resort handler: log the trace, return INTERNAL_ERROR (hide internals)."""

    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    payload = api_error_response(
        code=errors.INTERNAL_ERROR,
        message="Something went wrong on our side.",
    )
    return JSONResponse(status_code=500, content=payload.model_dump())


app.include_router(health_router, prefix="/api")
