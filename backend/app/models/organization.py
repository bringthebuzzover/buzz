"""``organizations`` table — student-org profile.

Owns IG handle + university + delivery address. ``user_id`` is unique so
one Buzz account maps to one org profile; deleting the user cascades.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    org_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    university: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    edu_email: Mapped[str] = mapped_column(sa.String(320), nullable=False)
    instagram_handle: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    tiktok_handle: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    follower_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    member_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    city: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    approved_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
