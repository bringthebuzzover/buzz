/**
 * Visible org-facing campaign status. Note the absence of `denied`: denied applications
 * are filtered out of My Campaigns entirely.
 */
export type OrgCampaignStatus =
  | "applied"
  | "accepted"
  | "active"
  | "finished";

/** Display order used by My Campaigns when sorting non-active campaigns. */
export const ORG_CAMPAIGN_STATUS_ORDER: readonly OrgCampaignStatus[] = [
  "active",
  "accepted",
  "applied",
  "finished",
] as const;

/** Human-readable labels for status badges. */
export const ORG_CAMPAIGN_STATUS_LABELS: Record<OrgCampaignStatus, string> = {
  applied: "Applied",
  accepted: "Accepted",
  active: "Active",
  finished: "Finished",
};
