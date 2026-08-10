/**
 * Derive org-facing My Campaigns status from application decision + brand tracker stage.
 *
 * Denied is filtered out of the visible surface (PRODUCT.md §6.4). Labels/order
 * live in `types/orgCampaign` and are re-exported here for a single import path.
 */

import type { OrgCampaignStatus } from "../types/orgCampaign";
export {
  ORG_CAMPAIGN_STATUS_LABELS,
  ORG_CAMPAIGN_STATUS_ORDER,
  type OrgCampaignStatus,
} from "../types/orgCampaign";

/** Map backend decision + tracker stage → visible org-campaign status. */
export function deriveOrgCampaignStatus(input: {
  decision: string;
  brandTrackerStage: string;
}): OrgCampaignStatus | null {
  if (input.decision === "denied") return null;
  if (input.decision === "applied") return "applied";
  if (input.decision === "accepted") {
    if (input.brandTrackerStage === "drop_active") return "active";
    if (input.brandTrackerStage === "drop_finished") return "finished";
    return "accepted";
  }
  return null;
}
