"""``drop_requests`` table — brand intake tickets (LAUNCH.md Phase B).

A ticket is not a live campaign. Brand "Plan your Campaign" creates one of these;
admins convert a ticket into an unpublished ``drops`` row, then Publish.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DropRequest(Base):
    __tablename__ = "drop_requests"
    __table_args__ = (sa.Index("ix_drop_requests_brand_id", "brand_id"),)

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    brand_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("brands.id"), nullable=False)

    message: Mapped[str] = mapped_column(sa.Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    # received | converted | closed
    status: Mapped[str] = mapped_column(sa.String(32), nullable=False, server_default="received")
    # Soft pointer to the minted drop; use_alter avoids circular create/drop with drops.
    converted_drop_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid,
        sa.ForeignKey(
            "drops.id",
            use_alter=True,
            name="fk_drop_requests_converted_drop_id",
        ),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )
