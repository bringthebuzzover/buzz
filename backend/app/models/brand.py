"""``brands`` table — brand-portal profile + auto-link anchor.

``instagram_handle`` (canonical, no leading ``@``) is the substring the
auto-link scan job greps for in caption text (§10.4). One brand profile
per user; deleting the user cascades.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import BrandStatusEnum


class Brand(Base):
    __tablename__ = "brands"
    # One brand account per company email, case-insensitive. The apply service
    # pre-checks + catches IntegrityError, but this index is the hard invariant
    # that makes two concurrent self-registrations safe.
    __table_args__ = (
        sa.Index(
            "uq_brands_company_email_lower",
            sa.func.lower(sa.text("company_email")),
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    brand_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    company_email: Mapped[str] = mapped_column(sa.String(320), nullable=False)
    intent_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    instagram_handle: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    status: Mapped[str] = mapped_column(BrandStatusEnum, nullable=False)

    approved_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
