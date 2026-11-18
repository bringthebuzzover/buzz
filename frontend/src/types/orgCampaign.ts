/**
 * Visible org-facing campaign status. Ended seats (denied, withdrew, removed) are
 * filtered out of My Campaigns entirely; a canceled drop keeps its seats visible.
 *
 * A live seat shows its own progress (plan §3.3), computed by the API:
 * Accepted → Shipped → Delivered → Posted.
 */
import type { SeatProgress } from "../utils/dropStage";

export type OrgCampaignStatus =
  | "applied"
  | "under_review"
  | SeatProgress
  | "wrapped"
  | "canceled";

/** Seated statuses: the org is in and its product and posts are under way. */
export const SEATED_STATUSES: readonly OrgCampaignStatus[] = [
  "accepted",
  "shipped",
  "delivered",
  "posted",
] as const;

/** Display order used by My Campaigns: seats in flight first, finished last. */
export const ORG_CAMPAIGN_STATUS_ORDER: readonly OrgCampaignStatus[] = [
  ...SEATED_STATUSES,
  "under_review",
  "applied",
  "wrapped",
  "canceled",
] as const;

/** Human-readable labels for status badges. */
export const ORG_CAMPAIGN_STATUS_LABELS: Record<OrgCampaignStatus, string> = {
  applied: "Applied",
  under_review: "Under review",
  accepted: "Accepted",
  shipped: "Shipped",
  delivered: "Delivered",
  posted: "Posted",
  wrapped: "Wrapped",
  canceled: "Canceled",
};
