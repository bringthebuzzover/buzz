"""Add defense-in-depth CHECKs for drop capacity, units, window, and allocations.

Preflight aborts if dirty rows exist. Constraints are added NOT VALID then
VALIDATE so existing valid data stays online without a long rewrite lock.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DROP_CHECKS = (
    ("ck_drops_capacity_positive", "capacity_total >= 1"),
    (
        "ck_drops_units_null_or_positive",
        "total_product_units IS NULL OR total_product_units >= 1",
    ),
    ("ck_drops_apply_window_ordered", "apply_open_at < apply_close_at"),
)
_APP_CHECK = (
    "ck_drop_applications_allocated_units_nonneg",
    "allocated_units IS NULL OR allocated_units >= 0",
)


def _constraint_exists(conn, table: str, name: str) -> bool:
    return (
        conn.execute(
            sa.text("""
                SELECT 1
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE t.relname = :table
                  AND c.conname = :name
                  AND n.nspname = current_schema()
                """),
            {"table": table, "name": name},
        ).scalar()
        is not None
    )


def upgrade() -> None:
    conn = op.get_bind()
    dirty_drops = conn.execute(sa.text("""
            SELECT id FROM drops
            WHERE capacity_total < 1
               OR (total_product_units IS NOT NULL AND total_product_units < 1)
               OR apply_open_at >= apply_close_at
            """)).all()
    if dirty_drops:
        raise RuntimeError(
            "Cannot add drop CHECKs: dirty rows " f"{[str(r[0]) for r in dirty_drops[:10]]}"
        )
    dirty_apps = conn.execute(sa.text("""
            SELECT id FROM drop_applications
            WHERE allocated_units IS NOT NULL AND allocated_units < 0
            """)).all()
    if dirty_apps:
        raise RuntimeError(
            "Cannot add allocated_units CHECK: dirty rows "
            f"{[str(r[0]) for r in dirty_apps[:10]]}"
        )

    for name, expr in _DROP_CHECKS:
        if not _constraint_exists(conn, "drops", name):
            op.create_check_constraint(name, "drops", expr, postgresql_not_valid=True)
        op.execute(sa.text(f"ALTER TABLE drops VALIDATE CONSTRAINT {name}"))

    if not _constraint_exists(conn, "drop_applications", _APP_CHECK[0]):
        op.create_check_constraint(
            _APP_CHECK[0],
            "drop_applications",
            _APP_CHECK[1],
            postgresql_not_valid=True,
        )
    op.execute(sa.text(f"ALTER TABLE drop_applications VALIDATE CONSTRAINT {_APP_CHECK[0]}"))


def downgrade() -> None:
    conn = op.get_bind()
    if _constraint_exists(conn, "drop_applications", _APP_CHECK[0]):
        op.drop_constraint(_APP_CHECK[0], "drop_applications", type_="check")
    for name, _expr in reversed(_DROP_CHECKS):
        if _constraint_exists(conn, "drops", name):
            op.drop_constraint(name, "drops", type_="check")
