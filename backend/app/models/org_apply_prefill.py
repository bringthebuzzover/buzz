"""``org_apply_prefills`` — hashed drafts for ``/org/apply?prefill=``.

Not a user. Apply still creates ``users`` / ``organizations``. Raw link secret
is emailed; only ``token_hash`` is stored.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OrgApplyPrefill(Base):
    __tablename__ = "org_apply_prefills"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(sa.String(64), unique=True, nullable=False)
    invite_email: Mapped[str] = mapped_column(sa.String(320), nullable=False)

    org_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    university: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    edu_email: Mapped[str | None] = mapped_column(sa.String(320), nullable=True)
    instagram_handle: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    member_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    category: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    shipping_line1: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    shipping_line2: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    shipping_city: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    shipping_state: Mapped[str | None] = mapped_column(sa.String(2), nullable=True)
    shipping_postal_code: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    shipping_raw: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    extras: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    source: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    source_row_key: Mapped[str | None] = mapped_column(sa.String(320), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    used_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
