/**
 * Pure helpers that derive a drop's org-facing feed chip (Upcoming / Open / Closed)
 * from the API stage, the live clock, and capacity fill.
 *
 * - Before `applyOpenAt`: Upcoming.
 * - Wrapped, past `applyCloseAt`, or full: Closed. Reopening is just BUZZ
 *   moving the close date, so the clock alone decides the window.
 * - Otherwise: Open.
 *
 * `getDropClosedReason` returns a tag for UI copy ("apply window ended" vs "all spots filled").
 */

import type {
  DropCardData,
  DropClosedReason,
  DropFeedStatus,
} from "../types/drop";
import { dropStageLabel, type DropStage } from "./dropStage";

/** Whether the drop has filled all its capacity. */
export function isDropFull(drop: DropCardData, acceptedCount: number): boolean {
  return acceptedCount >= drop.capacityTotal;
}

/** Spots remaining (clamped at 0). */
export function spotsRemaining(drop: DropCardData, acceptedCount: number): number {
  return Math.max(0, drop.capacityTotal - acceptedCount);
}

/**
 * Live org-feed UX clock. Backend enforcement SOT is
 * `drop_apply_eligibility` in `backend/app/services/drops.py` — keep this
 * aligned for card chips, but never treat the FE as the gate.
 */
export function getDropFeedStatus(
  drop: DropCardData,
  acceptedCount: number,
  now: number
): DropFeedStatus {
  if (drop.stage === "wrapped") return "closed";
  if (now < drop.applyOpenAt) return "upcoming";
  if (isDropFull(drop, acceptedCount)) return "closed";
  if (now > drop.applyCloseAt) return "closed";
  return "open";
}

/**
 * Returns the reason a drop is closed, used for chip copy on closed cards.
 * Only meaningful when `getDropFeedStatus` returned `"closed"`.
 */
export function getDropClosedReason(
  drop: DropCardData,
  acceptedCount: number,
  now: number
): DropClosedReason | null {
  if (getDropFeedStatus(drop, acceptedCount, now) !== "closed") return null;
  if (drop.stage === "wrapped") return "manual";
  if (isDropFull(drop, acceptedCount)) return "spots_filled";
  if (now > drop.applyCloseAt) return "apply_window_ended";
  return "manual";
}

/** Display copy bundle for a closed reason. */
export const CLOSED_REASON_COPY: Record<DropClosedReason, string> = {
  apply_window_ended: "Applications closed",
  spots_filled: "All spots filled",
  manual: "Applications closed",
};

/**
 * Chip for a drop no longer taking applications. "Closed" is never a stage
 * (D-16): it reads "Applications closed" until seats go live, then the stage.
 */
export function closedChipLabel(stage: DropStage): string {
  if (stage === "live") return "In progress";
  if (stage === "wrapped" || stage === "canceled") return dropStageLabel(stage);
  return "Applications closed";
}
