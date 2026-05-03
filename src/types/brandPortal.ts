/**
 * Brand portal domain types — the read-only 5-stage tracker stages and the rolled-up
 * brand-side summary view of a drop (no per-org breakdown in v1).
 */

/** Read-only brand-facing tracker (PRODUCT.md §5.2). */
export type BrandDropTrackerStage =
  | "request_received"
  | "campaign_drops"
  | "applicant_selection"
  | "products_in_transit"
  | "active_campaign"
  | "completed";

/** Display copy bundle for a tracker stage (label + helper subcopy). */
export type BrandDropTrackerStageCopy = {
  label: string;
  subcopy: string;
};

/** Canonical order of the brand tracker stages (left-to-right rendering). */
export const BRAND_DROP_TRACKER_ORDER: readonly BrandDropTrackerStage[] = [
  "request_received",
  "campaign_drops",
  "applicant_selection",
  "products_in_transit",
  "active_campaign",
  "completed",
] as const;

/** Spec-aligned copy for each stage (PRODUCT.md §5.2). */
export const BRAND_DROP_TRACKER_COPY: Record<
  BrandDropTrackerStage,
  BrandDropTrackerStageCopy
> = {
  request_received: {
    label: "Request Received",
    subcopy: "A representative will contact you soon.",
  },
  campaign_drops: {
    label: "Campaign Drops",
    subcopy: "Organizations can now apply.",
  },
  applicant_selection: {
    label: "Applicant Selection",
    subcopy: "Applications closed; curating selected partners.",
  },
  products_in_transit: {
    label: "Products in Transit",
    subcopy: "Shipment is on the way — tracking below.",
  },
  active_campaign: {
    label: "Active Campaign",
    subcopy: "Your campaign is live.",
  },
  completed: {
    label: "Completed",
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
