"""University marketing budget ranges a brand can apply with.

``MarketingBudget`` is the only written list of codes. The tuple, the display
labels, and the ``brands.marketing_budget`` CHECK are all derived from it, so a
new range is one edit and the three layers cannot drift apart. Migrations keep
their own frozen copy of the SQL on purpose — history must not move.
"""

from __future__ import annotations

from typing import Literal, get_args

MarketingBudget = Literal["5_20k", "20k_50k", "50k_100k", "100k_plus"]

MARKETING_BUDGET_CODES: tuple[MarketingBudget, ...] = get_args(MarketingBudget)

# Display labels. Every code above needs an entry; tests assert the two sets
# match so a new range cannot ship without one.
MARKETING_BUDGET_LABELS: dict[MarketingBudget, str] = {
    "5_20k": "$5–20k",
    "20k_50k": "$20k–$50k",
    "50k_100k": "$50k–$100k",
    "100k_plus": "$100k+",
}


def marketing_budget_check_sql() -> str:
    """The ``brands.marketing_budget`` CHECK body, built from the codes."""
    values = ", ".join(f"'{code}'" for code in MARKETING_BUDGET_CODES)
    return f"marketing_budget IS NULL OR marketing_budget IN ({values})"
