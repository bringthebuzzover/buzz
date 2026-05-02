/**
 * Org-side campaign domain types.
 *
 * - `DropApplication` is the persisted application record (decision + timestamps).
 * - `OrgCampaignStatus` is the derived org-facing status shown in My Campaigns.
 *   `Denied` exists in `ApplicationDecision` but is intentionally absent from the visible
 *   surface (PRODUCT.md §6.4: denials are email-only).
 */

/** Decision recorded against an application by Buzz. */
export type ApplicationDecision =
  | "applied"
  | "accepted"
  | "denied"
  | "waitlisted";

/**
 * Visible org-facing campaign status. Note the absence of `denied`: denied applications
 * are filtered out of My Campaigns entirely.
 */
export type OrgCampaignStatus =
  | "applied"
  | "waitlisted"
  | "accepted"
  | "active"
  | "finished";

/** Display order used by My Campaigns when sorting non-active campaigns. */
export const ORG_CAMPAIGN_STATUS_ORDER: readonly OrgCampaignStatus[] = [
  "active",
  "accepted",
  "waitlisted",
  "applied",
  "finished",
] as const;

/** Human-readable labels for status badges. */
export const ORG_CAMPAIGN_STATUS_LABELS: Record<OrgCampaignStatus, string> = {
  applied: "Applied",
  waitlisted: "Waitlisted",
  accepted: "Accepted",
  active: "Active",
  finished: "Finished",
};

/** A row in the applications store. */
export type DropApplication = {
  id: string;
  dropId: string;
  orgId: string;
  /** Decision recorded by Buzz (or `applied` initial state). */
  decision: ApplicationDecision;
  /** When the org applied (or opted into waitlist). */
  appliedAt: number;
  /** When Buzz made a decision (accept/deny/waitlist). */
  decisionAt?: number;
  /** Optional pitch text submitted by the org with the application. */
  pitch?: string;
  /** Optional tracking number shipped to the org once accepted (mirrors brand tracking). */
  trackingNumber?: string;

  /** Units allocated to this org when the brand finalizes Applicant Selection. */
  allocatedUnits?: number;
};

/**
 * Derived view object combining a participation record with its source drop, used by
 * UI components rendering My Campaigns rows and detail pages.
 */
export type OrgCampaignParticipation = {
  applicationId: string;
  dropId: string;
  orgId: string;
  status: OrgCampaignStatus;
  /** Application row's `appliedAt` (used for recency sort). */
  appliedAt: number;
  /** Optional tracking number to display on Accepted/Active. */
  trackingNumber?: string;
};
