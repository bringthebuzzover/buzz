"""``post_campaign_links`` table — confirmed (post, campaign) attribution.

``UNIQUE(post_id)`` enforces the PRODUCT.md §4.2 invariant: **one post can
belong to at most one campaign**. Anything that would create a second link
for the same post must raise ``IntegrityError`` at the DB layer — tested
in ``tests/test_constraints.py``.

``drop_id`` is denormalized so dashboard queries can filter without joining
through ``drop_applications``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import PostLinkSourceEnum


class PostCampaignLink(Base):
    __tablename__ = "post_campaign_links"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("social_posts.id"), unique=True, nullable=False
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("drop_applications.id"), nullable=False
    )
    drop_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, sa.ForeignKey("drops.id"), nullable=False)

    source: Mapped[str] = mapped_column(PostLinkSourceEnum, nullable=False)
    linked_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
