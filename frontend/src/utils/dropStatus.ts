/**
 * Pure helpers that derive a drop's org-facing feed chip (Upcoming / Open / Closed)
 * from the API stage and whether every spot is taken. The API stage is the one
 * clock; the chip never re-derives the window from the dates.
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

/** Upcoming before the window, Open while applying with spots left, else Closed. */
export function getDropFeedStatus(stage: DropStage, full: boolean): DropFeedStatus {
  if (stage === "upcoming") return "upcoming";
  if (stage === "applying" && !full) return "open";
  return "closed";
}

/** Why a drop is closed (chip copy); null unless `getDropFeedStatus` is "closed". */
export function getDropClosedReason(stage: DropStage, full: boolean): DropClosedReason | null {
  if (getDropFeedStatus(stage, full) !== "closed") return null;
  if (stage === "wrapped") return "manual";
  if (full) return "spots_filled";
  return "apply_window_ended";
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

/** "Nov 10": the day a brand-facing lifecycle date falls on. */
export function shortDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
