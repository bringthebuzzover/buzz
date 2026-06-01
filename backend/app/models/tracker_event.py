"""``drop_tracker_events`` table — audit log for ``drops.brand_tracker_stage``.

Each row records a stage transition (or an arbitrary note at the current
stage). Admin UI replays these to render the fulfillment history.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import BrandTrackerStageEnum


class DropTrackerEvent(Base):
    __tablename__ = "drop_tracker_events"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    drop_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("drops.id"), nullable=False)

    stage: Mapped[str] = mapped_column(BrandTrackerStageEnum, nullable=False)
    note: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    occurred_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
