/**
 * Brand tracker history store — backed by `buzz.v1.brandTracker`. Records each
 * stage transition for a drop so the brand-side detail view can show a timeline.
 *
 * Tracker stage *current value* lives on the `Drop` row itself (`brandTrackerStage`).
 * This store augments it with per-event history (timestamp, stage, optional note).
 */
import type { BrandDropTrackerStage } from "../../types/brandPortal";
import { readJSON, storeEvents, storeKey, writeJSON } from "./mockStore";

export type BrandTrackerEvent = {
  id: string;
  dropId: string;
  stage: BrandDropTrackerStage;
  occurredAt: number;
  /** Optional note (e.g. "Tracking #1Z999AA10123456784"). */
  note?: string;
};

const KEY = storeKey("brandTracker");

let cache: BrandTrackerEvent[] | null = null;

function load(): BrandTrackerEvent[] {
  if (cache != null) return cache;
  cache = readJSON<BrandTrackerEvent[]>(KEY, []);
  return cache;
}

function persist(next: BrandTrackerEvent[]): void {
  cache = next;
  writeJSON(KEY, next);
}

export const brandTrackerStore = {
  getAll(): BrandTrackerEvent[] {
    return load();
  },

  listForDrop(dropId: string): BrandTrackerEvent[] {
    return load()
      .filter((e) => e.dropId === dropId)
      .sort((a, b) => a.occurredAt - b.occurredAt);
  },

  insert(event: BrandTrackerEvent): void {
    persist([...load(), event]);
  },

  replaceAll(rows: BrandTrackerEvent[]): void {
    persist(rows);
  },

  invalidate(): void {
    cache = null;
    storeEvents.emit();
  },

  subscribe: storeEvents.subscribe,
};
