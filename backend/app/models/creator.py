"""``creators`` table — individual student creator profile.

Sibling of ``organizations`` and ``brands``. One row per creator user.
Lifecycle lives here, not on ``users.status``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import CreatorStatusEnum


class Creator(Base):
    __tablename__ = "creators"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    school: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    city: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    grad_year: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    niches: Mapped[list[str]] = mapped_column(ARRAY(sa.String(64)), nullable=False)
    bio: Mapped[str] = mapped_column(sa.Text, nullable=False)
    claimed_instagram_username: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    tiktok_handle: Mapped[str] = mapped_column(sa.String(255), nullable=False, server_default="")
    open_to: Mapped[list[str]] = mapped_column(ARRAY(sa.String(64)), nullable=False)
    status: Mapped[str] = mapped_column(CreatorStatusEnum, nullable=False)
    follower_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    post_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
