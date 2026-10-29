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
    # At most one *active* application per (drop, org). A prior ``denied`` or
    # ``withdrew`` row does not block re-applying (so a plain UNIQUE would be
    # wrong); a ``removed`` row does. The partial unique index makes that a
    # hard DB guarantee.
    __table_args__ = (
        sa.Index(
            "uq_drop_application_active",
            "drop_id",
            "org_id",
            unique=True,
            postgresql_where=sa.text("decision NOT IN ('denied', 'withdrew')"),
        ),
        sa.CheckConstraint(
            "allocated_units IS NULL OR allocated_units >= 0",
            name="ck_drop_applications_allocated_units_nonneg",
        ),
        sa.CheckConstraint(
            "added_by IN ('apply', 'late_add')", name="ck_drop_applications_added_by"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    drop_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("drops.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=False
    )

    decision: Mapped[str] = mapped_column(ApplicationDecisionEnum, nullable=False)
    pitch: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    # Shipment tracking lives on ``drop_application_shipments`` (0–N per seat).
    allocated_units: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    applied_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    decision_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    # When the decision went out ("Send decisions" or a late-add). Until then an
    # accepted/denied seat is a draft only the brand and BUZZ see; the org still
    # sees ``applied``.
    decision_sent_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    # ``apply`` (the org applied) or ``late_add`` (BUZZ seated it directly).
    added_by: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default="apply", default="apply"
    )
    # The org has the product ("I got it", or BUZZ). A fact, never a gate.
    delivered_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    # Why the seat ended (withdrew or removed). BUZZ-only.
    end_reason: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
