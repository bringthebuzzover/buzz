"""``org_connect_tokens`` — one-shot Connect Instagram links after Approve.

Issued when an admin approves an org into ``pending_instagram``. ``token_hash``
is the SHA-256 hex of the raw link secret (unique); ``used_at`` flips on redeem.
Mirrors ``brand_invite_tokens`` (LAUNCH.md Phase A).
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OrgConnectToken(Base):
    __tablename__ = "org_connect_tokens"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("organizations.id"), nullable=False
    )

    token_hash: Mapped[str] = mapped_column(sa.String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(sa.String(320), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
