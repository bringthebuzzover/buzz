"""``org_ig_change_requests`` — org Instagram identity change tickets (PRODUCT §3.1.4).

A ticket is not an identity write. Admin approve either tells the org to log in
again (rename) or releases Graph ids and demotes to ``pending_instagram``
(account switch). Typed ``@`` is never treated as a Graph id.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OrgIgChangeRequest(Base):
    __tablename__ = "org_ig_change_requests"
    __table_args__ = (
        sa.Index("ix_org_ig_change_requests_org_id", "org_id"),
        sa.Index(
            "uq_org_ig_change_requests_one_pending",
            "org_id",
            unique=True,
            postgresql_where=sa.text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), nullable=False)

    # rename | account_switch — org hint; admin decides at approve.
    kind: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    current_handle: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    requested_handle: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    reason: Mapped[str] = mapped_column(sa.Text, nullable=False)

    # pending | approved | denied
    status: Mapped[str] = mapped_column(sa.String(32), nullable=False, server_default="pending")
    decided_kind: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
