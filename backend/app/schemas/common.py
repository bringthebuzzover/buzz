"""Shared building blocks for frontend-facing response schemas.

Stage 4 fixed the wire convention: responses are **camelCase** with **epoch-ms**
datetimes so they match the frontend TypeScript types field-for-field (no
remapping in the React hooks). ``CamelModel`` and ``to_epoch_ms`` centralize
that convention so every Stage 5 schema applies it identically.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for frontend-facing schemas: camelCase aliases, populate by name.

    ``populate_by_name`` lets services build instances with the snake_case
    field names while the serialized output (and accepted request bodies) use
    camelCase aliases.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def to_epoch_ms(value: datetime | None) -> int | None:
    """Serialize a datetime to epoch milliseconds (``None`` passes through).

    Datetime columns are ``timezone=True`` so values are tz-aware; we
    defensively coerce a naive value to UTC so ``.timestamp()`` can't silently
    use the server's local offset.
    """

    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)
