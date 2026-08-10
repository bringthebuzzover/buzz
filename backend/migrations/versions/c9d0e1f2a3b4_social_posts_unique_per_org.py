"""Scope social_posts uniqueness to (org_id, platform, external_id).

Global UNIQUE(platform, external_id) dropped a second org's insert when the
same Meta media id appeared under two orgs. Idempotent sync stays per-org.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD = "uq_social_posts_platform_external_id"
_NEW = "uq_social_posts_org_platform_external_id"


def upgrade() -> None:
    conn = op.get_bind()
    collisions = conn.execute(
        sa.text(
            """
            SELECT platform, external_id, COUNT(DISTINCT org_id) AS orgs
            FROM social_posts
            GROUP BY platform, external_id
            HAVING COUNT(DISTINCT org_id) > 1
            """
        )
    ).all()
    if collisions:
        sample = ", ".join(f"{r.platform}:{r.external_id} ({r.orgs} orgs)" for r in collisions[:5])
        raise RuntimeError(
            "Cannot migrate social_posts uniqueness: cross-org external_id "
            f"collisions exist ({len(collisions)}). Sample: {sample}. "
            "Resolve data before re-running (gaps/models.social-posts-global-unique)."
        )

    op.drop_constraint(_OLD, "social_posts", type_="unique")
    op.create_unique_constraint(
        _NEW,
        "social_posts",
        ["org_id", "platform", "external_id"],
    )


def downgrade() -> None:
    op.drop_constraint(_NEW, "social_posts", type_="unique")
    op.create_unique_constraint(_OLD, "social_posts", ["platform", "external_id"])
