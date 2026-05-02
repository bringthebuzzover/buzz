/**
 * Derives the org-facing campaign status (Applied / Waitlisted / Accepted / Active /
 * Finished) from a `DropApplication` plus the parent `Drop`. `Denied` applications
 * intentionally have no visible status — callers should filter them out before
 * calling this helper, or treat the `null` return as "do not render".
 */

import type { Drop } from "../types/drop";
import type {
  DropApplication,
  OrgCampaignStatus,
} from "../types/orgCampaign";

/**
 * Returns the visible status, or `null` when the application is `denied` (denials
 * are email-only — never surfaced to the org in My Campaigns).
 */
export function deriveOrgCampaignStatus(
  application: DropApplication,
  drop: Drop
): OrgCampaignStatus | null {
  switch (application.decision) {
    case "denied":
      return null;
    case "applied":
      return "applied";
    case "waitlisted":
      return "waitlisted";
    case "accepted":
      if (drop.brandTrackerStage === "completed") return "finished";
      if (drop.brandTrackerStage === "active_campaign") return "active";
      return "accepted";
  }
}
