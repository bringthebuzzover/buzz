"""In-memory rate limiting for auth + public endpoints (architecture §11.1).

A fixed-window counter keyed by ``bucket:identity`` (identity = client IP, or the
submitted account for login). Process-local — it assumes a **single web replica**
(see DEPLOYMENT.md); the moment a second replica runs, counters split. For an MVP
on Railway that's an acceptable, documented limitation (Redis is the upgrade
path). ``settings.RATE_LIMIT_ENABLED`` is read at request time so it can be
toggled (the test suite disables it).

Usage:

* per-IP, as a route dependency::

      @router.post("/x", dependencies=[Depends(rate_limited("x", limit=10, window=60))])

* per-account, imperatively inside a handler (before expensive work)::

      enforce_account_limit("brand_login", email, limit=10, window=300)
"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

from fastapi import Request

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException

# key -> (window_start_monotonic, count)
_buckets: dict[str, tuple[float, int]] = {}

# Bound memory: an attacker rotating IPs / submitting many distinct login emails
# would otherwise grow _buckets without limit. When it exceeds this, sweep
# entries whose window has fully elapsed (older than the longest window in use),
# and if that isn't enough, drop the oldest entries to enforce a hard ceiling.
_MAX_BUCKETS = 10_000
_MAX_WINDOW_SECONDS = 600


def reset() -> None:
    """Clear all counters (used between tests)."""
    _buckets.clear()


def _evict_stale(now: float) -> None:
    stale = [k for k, (start, _) in _buckets.items() if now - start > _MAX_WINDOW_SECONDS]
    for k in stale:
        del _buckets[k]
    # Hard ceiling: a flood of distinct fresh keys won't be caught by the stale
    # sweep, so evict oldest-window entries until back under the cap. Evicting a
    # live counter only resets that key's window early (re-grants its budget) —
    # an acceptable failure mode for a DoS-sized burst.
    if len(_buckets) >= _MAX_BUCKETS:
        oldest = sorted(_buckets.items(), key=lambda kv: kv[1][0])
        for k, _ in oldest[: len(_buckets) - _MAX_BUCKETS + 1]:
            del _buckets[k]


def _client_ip(request: Request) -> str:
    # Prefer Railway's ``X-Real-IP`` (edge-set). Do not trust client-supplied
    # ``X-Forwarded-For`` for rate-limit buckets — it is spoofable. Fall back to
    # the direct peer (documented in DEPLOYMENT.md).
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
    client = request.client
    return client.host if client else "unknown"


def _allowed(key: str, limit: int, window: int) -> bool:
    now = time.monotonic()
    if key not in _buckets and len(_buckets) >= _MAX_BUCKETS:
        _evict_stale(now)
    start, count = _buckets.get(key, (now, 0))
    if now - start >= window:
        start, count = now, 0
    count += 1
    _buckets[key] = (start, count)
    return count <= limit


def _too_many() -> BuzzAPIException:
    return BuzzAPIException(
        errors.RATE_LIMITED,
        "Too many requests. Please slow down and try again shortly.",
        status_code=429,
    )


def rate_limited(bucket: str, *, limit: int, window: int) -> Callable[[Request], Awaitable[None]]:
    """Route dependency enforcing ``limit`` requests per ``window`` seconds per IP."""

    async def _dep(request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        if not _allowed(f"{bucket}:ip:{_client_ip(request)}", limit, window):
            raise _too_many()

    return _dep


def enforce_account_limit(bucket: str, identity: str, *, limit: int, window: int) -> None:
    """Per-identity limit (e.g. login email), called inside a handler before bcrypt."""
    if not settings.RATE_LIMIT_ENABLED:
        return
    if not _allowed(f"{bucket}:acct:{identity}", limit, window):
        raise _too_many()
