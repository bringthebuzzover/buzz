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
    # At most one *active* (non-denied) application per (drop, org): the apply
    # service rejects a duplicate non-denied row but a prior ``denied`` does not
    # block re-application (so a plain UNIQUE(drop_id, org_id) would be wrong —
    # it would forbid re-applying). A partial unique index makes that invariant
    # a hard DB guarantee while still allowing denied + re-applied rows.
    __table_args__ = (
        sa.Index(
            "uq_drop_application_active",
            "drop_id",
            "org_id",
            unique=True,
            postgresql_where=sa.text("decision <> 'denied' AND org_id IS NOT NULL"),
        ),
        sa.Index(
            "uq_drop_application_active_creator",
            "drop_id",
            "creator_id",
            unique=True,
            postgresql_where=sa.text("decision <> 'denied' AND creator_id IS NOT NULL"),
        ),
        sa.CheckConstraint(
            "(org_id IS NOT NULL AND creator_id IS NULL) OR "
            "(org_id IS NULL AND creator_id IS NOT NULL)",
            name="ck_drop_applications_one_owner",
        ),
        sa.CheckConstraint(
            "allocated_units IS NULL OR allocated_units >= 0",
            name="ck_drop_applications_allocated_units_nonneg",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    drop_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("drops.id"), nullable=False)
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=True
    )
    creator_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("creators.id"), nullable=True
    )

    decision: Mapped[str] = mapped_column(ApplicationDecisionEnum, nullable=False)
    pitch: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    content_state: Mapped[str] = mapped_column(
        sa.String(32), nullable=False, default="none", server_default="none"
    )
    payout_state: Mapped[str] = mapped_column(
        sa.String(32), nullable=False, default="not_recorded", server_default="not_recorded"
    )
    # Shipment tracking lives on ``drop_application_shipments`` (0–N per seat).
    allocated_units: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    applied_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    decision_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
