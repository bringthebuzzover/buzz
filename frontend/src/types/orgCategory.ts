/**
 * Org classification (PRODUCT.md §5.3.1) — mirrors the backend `OrgCategory`
 * native enum. Drives the signup selector and the brand-side applicant filter.
 */
export type OrgCategory =
  | "sorority"
  | "fraternity"
  | "sports"
  | "academic"
  | "social"
  | "other";

/** Display labels in the order shown to users. */
export const ORG_CATEGORY_OPTIONS: { value: OrgCategory; label: string }[] = [
  { value: "sorority", label: "Sorority" },
  { value: "fraternity", label: "Fraternity" },
  { value: "sports", label: "Sports" },
  { value: "academic", label: "Academic" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
];

/** Human-readable label for a category value (falls back to the raw value). */
export function orgCategoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ORG_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
