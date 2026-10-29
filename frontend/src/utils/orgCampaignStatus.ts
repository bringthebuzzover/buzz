/**
 * Org-facing My Campaigns status from the org-visible decision, the computed
 * drop stage and the API's per-seat progress. Labels only; nothing re-derived.
 *
 * Ended seats are filtered out of the visible surface (buzz-ops product/PRODUCT.md §6.4). Labels/order
 * live in `types/orgCampaign` and are re-exported here for a single import path.
 */

import type { OrgCampaignStatus } from "../types/orgCampaign";
import type { DropStage, SeatProgress } from "./dropStage";
export {
  ORG_CAMPAIGN_STATUS_LABELS,
  ORG_CAMPAIGN_STATUS_ORDER,
  SEATED_STATUSES,
  type OrgCampaignStatus,
} from "../types/orgCampaign";

export function deriveOrgCampaignStatus(input: {
  decision: string;
  stage: DropStage;
  progress?: SeatProgress | null;
}): OrgCampaignStatus | null {
  if (input.decision !== "applied" && input.decision !== "accepted") return null;
  if (input.stage === "canceled") return "canceled";
  if (input.decision === "applied") {
    // Plan: "Applied" while the window is open, "Under review" once it closes.
    return input.stage === "upcoming" || input.stage === "applying"
      ? "applied"
      : "under_review";
  }
  if (input.stage === "wrapped") return "wrapped";
  return input.progress ?? "accepted";
}
