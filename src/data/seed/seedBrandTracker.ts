/**
 * Seed brand tracker history events. The brand demo persona will see a small
 * timeline on each drop's detail page, derived from these events.
 */

import {
  BRAND_DROP_TRACKER_ORDER,
  type BrandDropTrackerStage,
} from "../../types/brandPortal";
import type { BrandTrackerEvent } from "../store/brandTrackerStore";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Builds tracker history events for each seeded drop owned by the demo brand.
 * Records every stage from `request_received` through the drop's current stage.
 */
export function buildSeedTrackerEvents(now: number): BrandTrackerEvent[] {
  const events: BrandTrackerEvent[] = [];

  function pushHistoryThrough(
    dropId: string,
    finalStage: BrandDropTrackerStage,
    startOffsetDays: number,
    trackingNote?: string,
  ): void {
    const startedAt = now - startOffsetDays * MS_PER_DAY;
    const finalIdx = BRAND_DROP_TRACKER_ORDER.indexOf(finalStage);
    const stages = BRAND_DROP_TRACKER_ORDER.slice(0, finalIdx + 1);
    stages.forEach((stage, idx) => {
      events.push({
        id: `evt-${dropId}-${stage}`,
        dropId,
        stage,
        occurredAt: startedAt + idx * MS_PER_DAY,
        note:
          stage === "products_in_transit" && trackingNote
            ? trackingNote
            : undefined,
      });
    });
  }

  // Drops with demo brand id: Poppi launch, PRIME Hydration partnership, Yerba Madre bid day.
  pushHistoryThrough("drop-poppi-launch", "active_campaign", 5);
  pushHistoryThrough(
    "drop-poppi-spring-tour",
    "products_in_transit",
    14,
    "Tracking #1Z999AA10123456784",
  );
  pushHistoryThrough("drop-poppi-finalizing", "applicant_selection", 1);

  return events;
}
