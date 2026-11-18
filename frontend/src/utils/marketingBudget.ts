import type { components } from "../api/generated/schema";

/**
 * University marketing budget ranges (Batch 6).
 *
 * The backend contract is the only written list of codes: `BrandApplyRequest`
 * carries the union, and the `Record` below fails to compile if a code is added
 * there without a label here. `<option>` order is this object's insertion
 * order, so it reads smallest to largest.
 */
export type MarketingBudget =
  components["schemas"]["BrandApplyRequest"]["marketingBudget"];

export const MARKETING_BUDGET_LABELS: Record<MarketingBudget, string> = {
  "5_20k": "$5–20k",
  "20k_50k": "$20k–$50k",
  "50k_100k": "$50k–$100k",
  "100k_plus": "$100k+",
};

/** `<option>` values, in display order. */
export const MARKETING_BUDGET_CODES = Object.keys(
  MARKETING_BUDGET_LABELS,
) as MarketingBudget[];

/** Admin-table label. Unknown/absent codes (legacy rows) read as an em dash. */
export function marketingBudgetLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return MARKETING_BUDGET_LABELS[code as MarketingBudget] ?? code;
}
