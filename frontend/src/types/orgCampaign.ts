/**
 * Visible org-facing campaign status. Ended seats (denied, withdrew, removed) are
 * filtered out of My Campaigns entirely; a canceled drop keeps its seats visible.
 */
export type OrgCampaignStatus =
  | "applied"
  | "accepted"
  | "active"
  | "finished"
  | "canceled";

/** Display order used by My Campaigns when sorting non-active campaigns. */
export const ORG_CAMPAIGN_STATUS_ORDER: readonly OrgCampaignStatus[] = [
  "active",
  "accepted",
  "applied",
  "finished",
  "canceled",
] as const;

/** Human-readable labels for status badges. */
export const ORG_CAMPAIGN_STATUS_LABELS: Record<OrgCampaignStatus, string> = {
  applied: "Applied",
  accepted: "Accepted",
  active: "Active",
  finished: "Finished",
  canceled: "Canceled",
};
