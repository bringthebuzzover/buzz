"""``notify_me`` table — org reminder preference for a single drop.

``UNIQUE(org_id, drop_id)`` so an org can hold at most one reminder per
drop; PATCH semantics overwrite the existing row rather than spawning a
second.

``reminder_minutes`` is a plain ``Integer``. PRODUCT.md restricts the value
to ``{5, 15, 60}`` but that lives in the API layer; a PG enum is overkill
for a numeric whitelist that may grow.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotifyMe(Base):
    __tablename__ = "notify_me"
    __table_args__ = (sa.UniqueConstraint("org_id", "drop_id", name="uq_notify_me_org_drop"),)

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=False
    )
    drop_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("drops.id"), nullable=False)

    reminder_minutes: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    enabled: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("true")
    )

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    #: Stamped by ``notify_reminders`` (§10.6) once the reminder email was
    #: accepted by the provider, so a failed attempt stays eligible to retry.
    sent_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
