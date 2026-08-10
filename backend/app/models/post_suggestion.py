"""``post_campaign_suggestions`` table — pending auto-link candidates.

Written by the auto-link scan job (§10.4) when a post's caption mentions
a brand handle or campaign hashtag. ``UNIQUE(post_id, application_id)``
makes re-running the scan idempotent.

Campaign membership is ``application_id`` → ``drop_applications.drop_id``.

``confirmed_at`` and ``dismissed_at`` are both nullable. The lifecycle is:

* both ``NULL`` — pending review by the org
* ``confirmed_at`` set — accepted; a matching ``post_campaign_links`` row
  is inserted in the same transaction
* ``dismissed_at`` set — org rejected, or the candidate became impossible
  (post gone, or the post was attributed to another campaign); the row is
  kept so the scan job does not resurface it

Because a post belongs to at most one campaign, attributing it dismisses every
other campaign's pending suggestion for that post.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import SuggestionMatchReasonEnum


class PostCampaignSuggestion(Base):
    __tablename__ = "post_campaign_suggestions"
    __table_args__ = (
        sa.UniqueConstraint(
            "post_id", "application_id", name="uq_post_campaign_suggestions_post_application"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("social_posts.id"), nullable=False
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("drop_applications.id"), nullable=False
    )

    match_reason: Mapped[str] = mapped_column(SuggestionMatchReasonEnum, nullable=False)
    match_evidence: Mapped[str] = mapped_column(sa.Text, nullable=False)

    suggested_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    dismissed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
