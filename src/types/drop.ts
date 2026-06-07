/**
 * Drop domain types — a Drop is a brand-run activation with capacity, an application window,
 * and lifecycle states that look different on the brand vs org side.
 *
 * - `BrandDropTrackerStage` is the read-only 5-stage progression the brand sees.
 * - `DropFeedStatus` is the org-facing browse status (Upcoming / Open / Closed).
 *
 * Status authority: Buzz (internal) is the sole authority for moving brand tracker stages.
 * Drop feed status is derived from timing + capacity + manual overrides (see `utils/dropStatus`).
 */

import type { BrandDropTrackerStage } from "./brandPortal";

/** Org-facing browse status used by the Drop Feed cards. */
export type DropFeedStatus = "upcoming" | "open" | "closed";

/** Reason a drop is currently `closed` (used for chip/copy on closed cards). */
export type DropClosedReason =
  | "apply_window_ended"
  | "spots_filled"
  | "manual";

/** Pre-baked status transition applied by the demo clock at a relative offset (ms from creation). */
export type ScheduledTransition = {
  /** ms after `createdAt` to trigger this transition. */
  offsetMs: number;
  /** New brand tracker stage to advance to. */
  toStage: BrandDropTrackerStage;
  /** Optional tracking number to assign at this transition (typically on `products_in_transit`). */
  assignTrackingNumber?: string;
};

/** Re-exported for callers that only consume drop types. */
export type { BrandDropTrackerStage } from "./brandPortal";

/**
 * The canonical drop entity. Capacity is `capacityTotal`; current accepted count is derived
 * from applications (see `utils/dropStatus`). `manualReopen` lets Buzz override an auto-close
 * past `applyCloseAt`. Brand-facing tracker stage is stored on the same row for v1 simplicity.
 */
export type Drop = {
  id: string;
  /** Owning brand id. */
  brandId: string;
  /** Brand display name (denormalized for read paths). */
  brandName: string;
  /** Drop title (working name). */
  title: string;
  /** Long-form description shown in detail views. */
  description: string;
  /** Hero image asset key or URL. */
  image: string;
  /** Display location/audience (e.g. "Cornell University"). */
  location: string;

  /** Total org spots in this drop. */
  capacityTotal: number;

  /** Application window opens. */
  applyOpenAt: number;
  /** Application window closes. */
  applyCloseAt: number;

  /** When true, ignore `applyCloseAt` auto-close (Buzz manually reopened). */
  manualReopen: boolean;

  /**
   * Notify-Me state for the calling org (API feed, §6.3.1): whether a reminder
   * is set and its lead time, so the Upcoming card shows the already-subscribed
   * state from the server. Optional — the demo path uses localStorage instead.
   */
  notifyRequested?: boolean;
  reminderMinutes?: number | null;

  /** Brand-facing tracker stage. */
  brandTrackerStage: BrandDropTrackerStage;

  /** Tracking number surfaced once products ship (shown on Products in Transit and beyond). */
  trackingNumber?: string;

  /**
   * Total product units the brand is allocating across selected orgs during
   * Applicant Selection (demo/local only).
   */
  totalProductUnits?: number;

  /**
   * Set when the brand finalizes applicant picks on the drop detail page;
   * unlocks the fulfillment summary view.
   */
  applicantSelectionFinalizedAt?: number;

  /** Created timestamp; used as origin for `scheduledTransitions`. */
  createdAt: number;

  /** Pre-baked stage transitions applied by the demo clock (set by request flow / seed). */
  scheduledTransitions?: ScheduledTransition[];
};

/**
 * The subset of `Drop` the org browse feed actually renders (see `DropFeedCard`
 * + `utils/dropStatus`). The Stage 4 API feed (`GET /api/drops`) returns exactly
 * these fields — brand/fulfillment fields (e.g. `brandTrackerStage`, whose
 * backend/frontend enum vocabularies differ) are intentionally omitted until the
 * Stage 5 brand surface reconciles them. A full `Drop` is assignable to this, so
 * the demo path is unaffected.
 */
export type DropCardData = Pick<
  Drop,
  | "id"
  | "brandName"
  | "title"
  | "description"
  | "image"
  | "location"
  | "capacityTotal"
  | "applyOpenAt"
  | "applyCloseAt"
  | "manualReopen"
  | "notifyRequested"
  | "reminderMinutes"
>;

/** A feed row: card data plus the two server-computed (or demo-derived) fields. */
export type DropFeedRow = DropCardData & {
  /** Number of accepted applications (drives "spots remaining"/full). */
  acceptedCount: number;
  /** Whether the current org already has a non-denied application on this drop. */
  alreadyApplied: boolean;
};
