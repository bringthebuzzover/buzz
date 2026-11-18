"""The marketing budget ranges are written once and derived everywhere.

``MarketingBudget`` in ``app.marketing_budget`` is the single written list; the
request schema, the label map, and the ``brands`` CHECK all come from it. These
tests fail if a new range is added to one place and not the others.
"""

from __future__ import annotations

from sqlalchemy import CheckConstraint

from app.marketing_budget import (
    MARKETING_BUDGET_CODES,
    MARKETING_BUDGET_LABELS,
    marketing_budget_check_sql,
)
from app.models.brand import Brand


def test_labels_cover_every_code() -> None:
    assert set(MARKETING_BUDGET_LABELS) == set(MARKETING_BUDGET_CODES)
    assert all(MARKETING_BUDGET_LABELS[code] for code in MARKETING_BUDGET_CODES)


def test_request_schema_accepts_exactly_the_codes() -> None:
    from app.schemas.brands import BrandApplyRequest

    field = BrandApplyRequest.model_fields["marketing_budget"]
    assert set(field.annotation.__args__) == set(MARKETING_BUDGET_CODES)


def test_model_check_is_built_from_the_shared_list() -> None:
    checks = [c for c in Brand.__table__.constraints if isinstance(c, CheckConstraint)]
    assert len(checks) == 1
    sqltext = str(checks[0].sqltext)
    assert sqltext == marketing_budget_check_sql()
    for code in MARKETING_BUDGET_CODES:
        assert f"'{code}'" in sqltext
