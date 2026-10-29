"""``drop_requests`` table — brand intake tickets (LAUNCH.md Phase B).

A ticket is not a live campaign. Brand "Plan your Campaign" creates one of these;
admins convert a ticket into an unpublished ``drops`` row, then Publish.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DropRequest(Base):
    __tablename__ = "drop_requests"
    __table_args__ = (sa.Index("ix_drop_requests_brand_id", "brand_id"),)

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    brand_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("brands.id"), nullable=False)

    message: Mapped[str] = mapped_column(sa.Text, nullable=False)
    # Nullable so tickets created before structured intake stay valid.
    # ``product`` is required on create; the column stays nullable.
    product: Mapped[str | None] = mapped_column(sa.String(1000), nullable=True)
    title: Mapped[str | None] = mapped_column(sa.String(120), nullable=True)
    location: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    target_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    org_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    units_per_org: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    campaign_hashtag: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
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
