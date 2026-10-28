"""Append-only admin audit rows.

No foreign keys: the log has to survive deletion of the application it names.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AdminAuditEvent(Base):
    __tablename__ = "admin_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, nullable=False, index=True)
    action: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    drop_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    application_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    detail: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
