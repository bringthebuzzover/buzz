"""Admin-reviewed replacement shipping addresses for organization accounts."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

_JSON_TYPE = sa.JSON().with_variant(JSONB(), "postgresql")


class OrgShippingChangeRequest(Base):
    __tablename__ = "org_shipping_change_requests"
    __table_args__ = (
        sa.Index("ix_org_shipping_change_requests_org_id", "org_id"),
        sa.Index(
            "uq_org_shipping_change_requests_one_pending",
            "org_id",
            unique=True,
            postgresql_where=sa.text("status = 'pending'"),
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'denied')",
            name="ck_org_shipping_change_requests_status",
        ),
        sa.CheckConstraint(
            "(status = 'pending' AND decided_at IS NULL) OR "
            "(status IN ('approved', 'denied') AND decided_at IS NOT NULL)",
            name="ck_org_shipping_change_requests_decision",
        ),
        sa.CheckConstraint(
            "redacted_at IS NOT NULL OR "
            "(current_address IS NOT NULL AND requested_address IS NOT NULL "
            "AND reason IS NOT NULL)",
            name="ck_org_shipping_change_requests_sensitive_fields",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    requester_user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reviewer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    current_address: Mapped[dict[str, Any] | None] = mapped_column(_JSON_TYPE, nullable=True)
    requested_address: Mapped[dict[str, Any] | None] = mapped_column(_JSON_TYPE, nullable=True)
    base_address_version: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default=sa.text("'pending'")
    )
    decision_reason: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    decided_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    redacted_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
