"""``waitlist`` table — public marketing waitlist signups.

No FK to ``users`` — submissions arrive before an account exists. Admin
triages these and either converts them into a real onboarding flow or
discards them.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import WaitlistEntityTypeEnum


class Waitlist(Base):
    __tablename__ = "waitlist"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)

    submitter_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    entity_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    email: Mapped[str] = mapped_column(sa.String(320), nullable=False)
    entity_type: Mapped[str] = mapped_column(WaitlistEntityTypeEnum, nullable=False)
    details: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
