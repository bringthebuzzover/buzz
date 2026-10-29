/**
 * Brand portal domain types — post-publish drop tracker stages and their labels.
 *
 * buzz-ops engineering/plans/archive/2026-seeded-launch.md Phase B: brand-facing stepper is three stages after publish.
 * Legacy stages remain typed for older drops / admin labels.
 */

/** Read-only brand-facing tracker stages (including legacy pre-publish). */
export type BrandDropTrackerStage =
  | "request_received"
  | "finalizing_agreements"
  | "awaiting_products"
  | "drop_active"
  | "drop_finished";

/**
 * Canonical post-publish order for the brand stepper
 * (awaiting_products → drop_active → drop_finished).
 */
export const BRAND_DROP_TRACKER_ORDER: readonly BrandDropTrackerStage[] = [
  "awaiting_products",
  "drop_active",
  "drop_finished",
] as const;

/** Full pipeline including legacy stages (admin filters / advance). */
export const BRAND_DROP_TRACKER_FULL_ORDER: readonly BrandDropTrackerStage[] = [
  "request_received",
  "finalizing_agreements",
  "awaiting_products",
  "drop_active",
  "drop_finished",
] as const;

/** Spec-aligned copy for each stage (architecture §8.5 / PRODUCT §5.2). */
export const BRAND_DROP_TRACKER_COPY: Record<BrandDropTrackerStage, { label: string }> = {
  request_received: { label: "Request Received" },
  finalizing_agreements: { label: "Finalizing Agreements" },
  awaiting_products: { label: "Awaiting Products" },
  drop_active: { label: "Drop Active" },
  drop_finished: { label: "Drop Finished" },
};
