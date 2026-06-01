"""``drop_applications`` table — an org's request to participate in a drop.

``allocated_units`` is non-null only when the parent drop has a
``total_product_units`` budget *and* this row's ``decision='accepted'``
(architecture §3.2).
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import ApplicationDecisionEnum


class DropApplication(Base):
    __tablename__ = "drop_applications"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    drop_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("drops.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=False
    )

    decision: Mapped[str] = mapped_column(ApplicationDecisionEnum, nullable=False)
    pitch: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    allocated_units: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    applied_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    decision_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
