/**
 * Derive org-facing My Campaigns status from the org-visible decision + the drop stage.
 *
 * Denied is filtered out of the visible surface (buzz-ops product/PRODUCT.md §6.4). Labels/order
 * live in `types/orgCampaign` and are re-exported here for a single import path.
 */

import type { OrgCampaignStatus } from "../types/orgCampaign";
import type { DropStage } from "./dropStage";
export {
  ORG_CAMPAIGN_STATUS_LABELS,
  ORG_CAMPAIGN_STATUS_ORDER,
  type OrgCampaignStatus,
} from "../types/orgCampaign";

/** Map org-visible decision + computed drop stage → visible org-campaign status. */
export function deriveOrgCampaignStatus(input: {
  decision: string;
  stage: DropStage;
}): OrgCampaignStatus | null {
  if (input.decision === "denied") return null;
  if (input.decision === "applied") return "applied";
  if (input.decision === "accepted") {
    if (input.stage === "live") return "active";
    if (input.stage === "wrapped") return "finished";
    return "accepted";
  }
  return null;
}
