"""Drop denormalized duplicate columns for single SOT

Revision ID: f1a2b3c4d5e6
Revises: e4f5a6b7c8d9
Create Date: 2026-08-03 19:00:00.000000

Removes mirrored/denormalized facts so each lives in one owner table:

* drops.brand_name → brands.brand_name
* drop_applications.tracking_number → drops.tracking_number
* organizations.edu_email → users.edu_email
* organizations.instagram_handle → users.instagram_username
* post_campaign_links.drop_id / post_campaign_suggestions.drop_id
  → drop_applications.drop_id via application_id
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("drops", "brand_name")
    op.drop_column("drop_applications", "tracking_number")
    op.drop_column("organizations", "edu_email")
    op.drop_column("organizations", "instagram_handle")
    # CASCADE drops the FK to drops.id (unnamed in the initial migration).
    op.execute("ALTER TABLE post_campaign_links DROP COLUMN drop_id CASCADE")
    op.execute("ALTER TABLE post_campaign_suggestions DROP COLUMN drop_id CASCADE")


def downgrade() -> None:
    op.add_column(
        "post_campaign_suggestions",
        sa.Column("drop_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "post_campaign_suggestions_drop_id_fkey",
        "post_campaign_suggestions",
        "drops",
        ["drop_id"],
        ["id"],
    )
    op.execute(
        """
        UPDATE post_campaign_suggestions AS s
        SET drop_id = a.drop_id
        FROM drop_applications AS a
        WHERE s.application_id = a.id
        """
    )
    op.alter_column("post_campaign_suggestions", "drop_id", nullable=False)

    op.add_column(
        "post_campaign_links",
        sa.Column("drop_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "post_campaign_links_drop_id_fkey",
        "post_campaign_links",
        "drops",
        ["drop_id"],
        ["id"],
    )
    op.execute(
        """
        UPDATE post_campaign_links AS l
        SET drop_id = a.drop_id
        FROM drop_applications AS a
        WHERE l.application_id = a.id
        """
    )
    op.alter_column("post_campaign_links", "drop_id", nullable=False)

    op.add_column(
        "organizations",
        sa.Column("instagram_handle", sa.String(length=255), nullable=True),
    )
    op.execute(
        """
        UPDATE organizations AS o
        SET instagram_handle = ltrim(btrim(u.instagram_username), '@')
        FROM users AS u
        WHERE o.user_id = u.id
        """
    )
    op.alter_column("organizations", "instagram_handle", nullable=False)

    op.add_column(
        "organizations",
        sa.Column("edu_email", sa.String(length=320), nullable=True),
    )
    op.execute(
        """
        UPDATE organizations AS o
        SET edu_email = u.edu_email
        FROM users AS u
        WHERE o.user_id = u.id AND u.edu_email IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE organizations
        SET edu_email = 'unknown@example.edu'
        WHERE edu_email IS NULL
        """
    )
    op.alter_column("organizations", "edu_email", nullable=False)

    op.add_column(
        "drop_applications",
        sa.Column("tracking_number", sa.String(length=255), nullable=True),
    )
    op.execute(
        """
        UPDATE drop_applications AS a
        SET tracking_number = d.tracking_number
        FROM drops AS d
        WHERE a.drop_id = d.id
          AND a.decision = 'accepted'
          AND d.tracking_number IS NOT NULL
        """
    )

    op.add_column(
        "drops",
        sa.Column("brand_name", sa.String(length=255), nullable=True),
    )
    op.execute(
        """
        UPDATE drops AS d
        SET brand_name = b.brand_name
        FROM brands AS b
        WHERE d.brand_id = b.id
        """
    )
    op.alter_column("drops", "brand_name", nullable=False)
