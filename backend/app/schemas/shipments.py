"""Shared shipment payload (admin, org campaigns, brand drop detail)."""

from __future__ import annotations

import uuid

from app.schemas.common import CamelModel


class ShipmentItem(CamelModel):
    id: uuid.UUID
    tracking_number: str
    carrier: str
    track_url: str | None


class AdminAddShipmentRequest(CamelModel):
    tracking_number: str
    carrier: str | None = None
