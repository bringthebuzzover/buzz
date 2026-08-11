"""``email_verification_tokens`` table — single-use links for ``.edu`` proofing.

Issued during org onboarding (architecture §3.3). ``token_hash`` is the SHA-256
hex of the raw link secret (unique) so a single click consumes a row exactly
once; ``used_at`` flips from NULL to a timestamp on redemption. Expired/used
tokens are kept for audit and swept later by the cleanup job (§10.3).
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), nullable=False)

    token_hash: Mapped[str] = mapped_column(sa.String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(sa.String(320), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
