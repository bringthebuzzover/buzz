"""``drop_tracker_events`` table — the drop's lifecycle log.

Each row records the computed stage at the time plus what happened
(``published``, ``hidden``, ``decisions sent``, ``wrapped``…). Rows written
before the lifecycle change carry the legacy tracker stage values.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DropTrackerEvent(Base):
    __tablename__ = "drop_tracker_events"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    drop_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("drops.id"), nullable=False)

    stage: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    note: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    occurred_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
