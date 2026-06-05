"""``brand_invite_tokens`` table — single-use setup links for brand accounts.

Issued when an admin approves a brand. ``token`` is unique so a single click
consumes a row exactly once; ``used_at`` flips from NULL to a timestamp on
redemption.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BrandInviteToken(Base):
    __tablename__ = "brand_invite_tokens"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), nullable=False)
    brand_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("brands.id"), nullable=False)

    token: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(sa.String(320), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
