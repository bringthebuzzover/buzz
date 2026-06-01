"""``drops`` table — a single brand campaign offered to student orgs.

``total_product_units`` is nullable to distinguish two campaign modes
(architecture §3.2 + PRODUCT.md §4.1):

* ``NULL`` — **spot-only** selection. Brand just accepts/denies orgs.
* ``>= 1`` — **unit-allocated**. Brand must split units across accepted
  orgs; ``DropApplication.allocated_units`` becomes meaningful.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import BrandTrackerStageEnum


class Drop(Base):
    __tablename__ = "drops"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    brand_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("brands.id"), nullable=False)
    brand_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)

    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    description: Mapped[str] = mapped_column(sa.Text, nullable=False)
    image: Mapped[str] = mapped_column(sa.String(1024), nullable=False)
    location: Mapped[str] = mapped_column(sa.String(255), nullable=False)

    capacity_total: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    apply_open_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    apply_close_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    manual_reopen: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("false")
    )

    brand_tracker_stage: Mapped[str] = mapped_column(BrandTrackerStageEnum, nullable=False)
    tracking_number: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    total_product_units: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    campaign_hashtag: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    applicant_selection_finalized_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
