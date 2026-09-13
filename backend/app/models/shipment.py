"""``drop_application_shipments`` — 0–N tracking numbers per accepted seat.

PRODUCT §3.1.1: SOT is this table, not ``drops.tracking_number`` (kept but
unread/unwritten on product paths after backfill).
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

CARRIERS = ("ups", "fedex", "unknown")


class DropApplicationShipment(Base):
    __tablename__ = "drop_application_shipments"
    __table_args__ = (
        sa.Index("ix_drop_application_shipments_application_id", "application_id"),
        sa.UniqueConstraint(
            "application_id",
            "tracking_number",
            name="uq_drop_application_shipments_app_tn",
        ),
        sa.CheckConstraint(
            "carrier IN ('ups', 'fedex', 'unknown')",
            name="ck_drop_application_shipments_carrier",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("drop_applications.id", ondelete="CASCADE"), nullable=False
    )
    tracking_number: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    carrier: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
