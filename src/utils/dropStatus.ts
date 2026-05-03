/**
 * Pure helpers that derive a drop's org-facing feed status (Upcoming / Open / Closed)
 * from its timing fields, current capacity fill, and the manual-reopen override.
 *
 * Spec rules (PRODUCT.md §6.3):
 * - Before `applyOpenAt`: Upcoming.
 * - After `applyCloseAt`: Closed (unless `manualReopen === true`).
 * - When `acceptedCount >= capacityTotal`: Closed (full).
 * - Otherwise: Open.
 *
 * `getDropClosedReason` returns a tag for UI copy ("apply window ended" vs "all spots filled").
 */

import type {
  Drop,
  DropClosedReason,
  DropFeedStatus,
} from "../types/drop";

/** Whether the drop has filled all its capacity. */
export function isDropFull(drop: Drop, acceptedCount: number): boolean {
  return acceptedCount >= drop.capacityTotal;
}

/** Spots remaining (clamped at 0). */
export function spotsRemaining(drop: Drop, acceptedCount: number): number {
  return Math.max(0, drop.capacityTotal - acceptedCount);
}

/** Compute the org-facing status for a drop. */
export function getDropFeedStatus(
  drop: Drop,
  acceptedCount: number,
  now: number
): DropFeedStatus {
  if (now < drop.applyOpenAt) return "upcoming";
  if (isDropFull(drop, acceptedCount)) return "closed";
  if (now > drop.applyCloseAt && !drop.manualReopen) return "closed";
  return "open";
}

/**
 * Returns the reason a drop is closed, used for chip copy on closed cards.
 * Only meaningful when `getDropFeedStatus` returned `"closed"`.
 */
export function getDropClosedReason(
  drop: Drop,
  acceptedCount: number,
  now: number
): DropClosedReason | null {
  if (getDropFeedStatus(drop, acceptedCount, now) !== "closed") return null;
  if (isDropFull(drop, acceptedCount)) return "spots_filled";
  if (now > drop.applyCloseAt) return "apply_window_ended";
  return "manual";
}

/** Display copy bundle for a closed reason. */
export const CLOSED_REASON_COPY: Record<DropClosedReason, string> = {
  apply_window_ended: "Closed — apply window ended",
  spots_filled: "Closed — all spots filled",
  manual: "Closed",
};
