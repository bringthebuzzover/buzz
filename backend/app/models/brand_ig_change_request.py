"""``brand_ig_change_requests`` — brand Instagram handle change tickets.

Brand ``@`` is autolink caption text, not a Graph login (PRODUCT §3.1.5).
A ticket is not the handle write. Admin approve sets ``brands.instagram_handle``.
One pending request per brand. The row is the audit record.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BrandIgChangeRequest(Base):
    __tablename__ = "brand_ig_change_requests"
    __table_args__ = (
        sa.Index("ix_brand_ig_change_requests_brand_id", "brand_id"),
        sa.Index(
            "uq_brand_ig_change_requests_one_pending",
            "brand_id",
            unique=True,
            postgresql_where=sa.text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    brand_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("brands.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), nullable=False)

    current_handle: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    requested_handle: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    reason: Mapped[str] = mapped_column(sa.Text, nullable=False)

    # pending | approved | denied
    status: Mapped[str] = mapped_column(sa.String(32), nullable=False, server_default="pending")
    decided_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
