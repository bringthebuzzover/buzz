"""``job_runs`` — thin observability for cron invocations via ``run_job.py``."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    job: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    ok: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
