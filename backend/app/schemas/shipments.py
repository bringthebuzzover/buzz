"""Shared shipment payload (admin, org campaigns, brand drop detail)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import field_serializer

from app.schemas.common import CamelModel, to_epoch_ms


class ShipmentItem(CamelModel):
    id: uuid.UUID
    tracking_number: str
    carrier: str
    track_url: str | None
    shipping_address_snapshot: dict[str, Any] | None = None
    shipping_address_captured_at: datetime | None = None

    @field_serializer("shipping_address_captured_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class AdminAddShipmentRequest(CamelModel):
    tracking_number: str
    carrier: str | None = None
