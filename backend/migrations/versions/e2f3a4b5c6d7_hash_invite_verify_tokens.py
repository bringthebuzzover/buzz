"""Hash brand invite + email verification tokens at rest.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-11
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_HASH_SQL = "encode(digest(convert_to(token, 'UTF8'), 'sha256'), 'hex')"


def _columns(table: str) -> set[str]:
    return {c["name"] for c in inspect(op.get_bind()).get_columns(table)}


def _hash_column(table: str) -> None:
    cols = _columns(table)
    if "token_hash" in cols and "token" not in cols:
        # Already at the hashed schema (e.g. pytest create_all from models).
        return

    if "token_hash" not in cols:
        op.add_column(table, sa.Column("token_hash", sa.String(length=64), nullable=True))

    if "token" in cols:
        op.execute(sa.text(f"UPDATE {table} SET token_hash = {_HASH_SQL}"))
        op.alter_column(table, "token_hash", nullable=False)
        # Unique may already exist from a prior partial run.
        existing = {u["name"] for u in inspect(op.get_bind()).get_unique_constraints(table)}
        uq = f"uq_{table}_token_hash"
        if uq not in existing:
            op.create_unique_constraint(uq, table, ["token_hash"])
        op.drop_column(table, "token")
    else:
        # token_hash present alongside missing token — ensure NOT NULL + unique.
        op.execute(sa.text(f"DELETE FROM {table} WHERE token_hash IS NULL"))
        op.alter_column(table, "token_hash", nullable=False)
        existing = {u["name"] for u in inspect(op.get_bind()).get_unique_constraints(table)}
        uq = f"uq_{table}_token_hash"
        if uq not in existing:
            op.create_unique_constraint(uq, table, ["token_hash"])


def upgrade() -> None:
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
    _hash_column("brand_invite_tokens")
    _hash_column("email_verification_tokens")


def downgrade() -> None:
    # Cannot restore plaintext secrets from hashes.
    raise NotImplementedError("Cannot downgrade hashed one-shot tokens to plaintext.")
