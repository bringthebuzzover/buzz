"""``users`` table — Buzz account identity.

One row per real human (or admin) regardless of which portal they use. The
``portal_role`` enum splits them into ``org`` / ``brand`` / ``admin``; the
matching profile sits in ``organizations`` or ``brands``.

Notable columns:

* ``instagram_user_id`` / ``instagram_*_token*`` — populated only for the
  org-side IG OAuth path (PRODUCT.md §6.1). Nullable on brand/admin rows.
* ``password_hash`` — set by Stage 3 brand-side password auth; nullable to
  cover org/admin rows that authenticate via IG OAuth. Kept on this table
  (rather than a sidecar ``brand_passwords``) so future role-switching needs
  one fewer join.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import OrgUserStatusEnum, PortalRoleEnum


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)

    instagram_user_id: Mapped[str | None] = mapped_column(
        sa.String(255), unique=True, nullable=True
    )
    instagram_username: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    instagram_access_token: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    instagram_token_issued_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    instagram_token_expires_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    instagram_token_refreshed_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    portal_role: Mapped[str] = mapped_column(PortalRoleEnum, nullable=False)
    status: Mapped[str] = mapped_column(OrgUserStatusEnum, nullable=False)

    edu_email: Mapped[str | None] = mapped_column(sa.String(320), unique=True, nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    password_hash: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
