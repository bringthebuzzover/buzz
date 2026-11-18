"""Timezone-aware time helpers shared by services, jobs and tests."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current time as an aware UTC datetime."""
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """Treat a naive datetime as UTC; leave an aware one unchanged."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
