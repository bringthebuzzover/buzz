import {
  MARKETING_BUDGET_CODES,
  MARKETING_BUDGET_LABELS,
  marketingBudgetLabel,
} from "./marketingBudget";

describe("marketingBudget", () => {
  it("labels every code smallest to largest", () => {
    expect(MARKETING_BUDGET_CODES).toEqual([
      "5_20k",
      "20k_50k",
      "50k_100k",
      "100k_plus",
    ]);
    expect(MARKETING_BUDGET_CODES.map((code) => MARKETING_BUDGET_LABELS[code]))
      .toEqual(["$5–20k", "$20k–$50k", "$50k–$100k", "$100k+"]);
  });

  it("reads absent and unknown codes as an em dash or the raw code", () => {
    expect(marketingBudgetLabel(null)).toBe("—");
    expect(marketingBudgetLabel(undefined)).toBe("—");
    expect(marketingBudgetLabel("")).toBe("—");
    expect(marketingBudgetLabel("5_20k")).toBe("$5–20k");
    expect(marketingBudgetLabel("250k_plus")).toBe("250k_plus");
  });
});
