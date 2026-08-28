/**
 * Brand portal domain types — post-publish drop tracker stages and the rolled-up
 * brand-side summary view of a drop (no per-org breakdown in v1).
 *
 * LAUNCH.md Phase B: brand-facing stepper is three stages after publish.
 * Legacy stages remain typed for older drops / admin labels.
 */

/** Read-only brand-facing tracker stages (including legacy pre-publish). */
export type BrandDropTrackerStage =
  | "request_received"
  | "finalizing_agreements"
  | "awaiting_products"
  | "drop_active"
  | "drop_finished";

/** Display copy bundle for a tracker stage (label + helper subcopy). */
export type BrandDropTrackerStageCopy = {
  label: string;
  subcopy: string;
};

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
export const BRAND_DROP_TRACKER_COPY: Record<
  BrandDropTrackerStage,
  BrandDropTrackerStageCopy
> = {
  request_received: {
    label: "Request Received",
    subcopy: "A representative will contact you soon.",
  },
  finalizing_agreements: {
    label: "Finalizing Agreements",
    subcopy: "Buzz is working out the details with the brand.",
  },
  awaiting_products: {
    label: "Awaiting Products",
    subcopy: "Shipment is on the way — tracking below.",
  },
  drop_active: {
    label: "Drop Active",
    subcopy: "Your campaign is live.",
  },
  drop_finished: {
    label: "Drop Finished",
    subcopy: "Campaign complete.",
  },
};

/**
 * Aggregated brand-side view of a single drop. Stays rolled-up across orgs for v1
 * (no per-org breakdown).
 */
export type BrandDropSummary = {
  dropId: string;
  brandId: string;
  title: string;
  trackerStage: BrandDropTrackerStage;
  trackingNumber?: string;
  totalPosts: number;
  totalEngagement: number;
  totalReach: number;
  /** Cost per engagement; null when no cost inputs exist (v1 default). */
  costPerEngagement: number | null;
  startedAt: number;
  finishedAt?: number;
};
