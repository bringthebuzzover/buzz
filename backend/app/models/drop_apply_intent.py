"""``drop_apply_intents`` — org intent to apply before ``active`` (PRODUCT §7.1).

Not a brand applicant. Promote writes ``drop_applications`` only at ``active``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import DropApplyIntentStatusEnum


class DropApplyIntent(Base):
    __tablename__ = "drop_apply_intents"
    __table_args__ = (
        sa.UniqueConstraint("org_id", "drop_id", name="uq_drop_apply_intents_org_drop"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=False, index=True
    )
    drop_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("drops.id"), nullable=False, index=True
    )
    pitch: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[str] = mapped_column(DropApplyIntentStatusEnum, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )
