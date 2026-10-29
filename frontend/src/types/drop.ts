/**
 * Drop types for the org browse feed.
 *
 * `stage` is the computed lifecycle stage from the API (see `utils/dropStage`);
 * `DropFeedStatus` is the card chip (Upcoming / Open / Closed) derived from it
 * plus the live clock and capacity (see `utils/dropStatus`).
 */

import type { DropStage } from "../utils/dropStage";

/** Org-facing browse status used by the Drop Feed cards. */
export type DropFeedStatus = "upcoming" | "open" | "closed";

/** Reason a drop is currently `closed` (used for chip/copy on closed cards). */
export type DropClosedReason = "apply_window_ended" | "spots_filled" | "manual";

/** What the org browse feed renders (`GET /api/drops` returns these fields). */
export type DropCardData = {
  id: string;
  /** Brand display name (joined from brands on read). */
  brandName: string;
  title: string;
  description: string;
  /** Hero image asset key or URL. */
  image: string;
  /** Display location/audience (e.g. "Cornell University"). */
  location: string;
  /** Total org spots in this drop. */
  capacityTotal: number;
  /** Application window (epoch ms). */
  applyOpenAt: number;
  applyCloseAt: number;
  /** Computed lifecycle stage (API). */
  stage: DropStage;
  /** Notify-Me state for the calling org (§6.3.1). */
  notifyRequested?: boolean;
  reminderMinutes?: number | null;
};

/** A feed row: card data plus the two server-computed fields. */
export type DropFeedRow = DropCardData & {
  /** Sent accepted seats; drives spots remaining / full. */
  acceptedCount: number;
  /** Whether the current org already has a non-denied application on this drop. */
  alreadyApplied: boolean;
};
