"""Portfolio links a creator adds on their profile."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CreatorPortfolioItem(Base):
    __tablename__ = "creator_portfolio_items"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("creators.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    link: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    format: Mapped[str] = mapped_column(sa.String(64), nullable=False, server_default="Post")
    source: Mapped[str] = mapped_column(sa.String(32), nullable=False, server_default="supplied")
    image_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
