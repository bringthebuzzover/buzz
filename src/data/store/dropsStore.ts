/**
 * Drops entity store — backed by `buzz.v1.drops`. CRUD plus subscribe.
 */
import type { Drop } from "../../types/drop";
import type { BrandDropTrackerStage } from "../../types/brandPortal";
import { readJSON, storeEvents, storeKey, writeJSON } from "./mockStore";

const KEY = storeKey("drops");

let cache: Drop[] | null = null;

function load(): Drop[] {
  if (cache != null) return cache;
  cache = readJSON<Drop[]>(KEY, []);
  return cache;
}

function persist(next: Drop[]): void {
  cache = next;
  writeJSON(KEY, next);
}

export const dropsStore = {
  /** Snapshot — returns the same array reference between writes for `useSyncExternalStore`. */
  getAll(): Drop[] {
    return load();
  },

  getById(id: string): Drop | undefined {
    return load().find((d) => d.id === id);
  },

  /** Returns all drops belonging to a specific brand. */
  listByBrand(brandId: string): Drop[] {
    return load().filter((d) => d.brandId === brandId);
  },

  /** Append a new drop. Caller is responsible for unique id generation. */
  insert(drop: Drop): void {
    persist([...load(), drop]);
  },

  /** Replace an entire drop row. No-op if id not found. */
  update(id: string, patch: Partial<Drop>): void {
    const next = load().map((d) => (d.id === id ? { ...d, ...patch } : d));
    persist(next);
  },

  /** Convenience for the demo clock: advances the brand tracker stage. */
  setBrandTrackerStage(
    id: string,
    stage: BrandDropTrackerStage,
    trackingNumber?: string
  ): void {
    const next = load().map((d) =>
      d.id === id
        ? {
            ...d,
            brandTrackerStage: stage,
            trackingNumber: trackingNumber ?? d.trackingNumber,
          }
        : d
    );
    persist(next);
  },

  /** Replace the entire collection (used by the seeder). */
  replaceAll(rows: Drop[]): void {
    persist(rows);
  },

  /** Drop the in-memory cache (used after a reseed). */
  invalidate(): void {
    cache = null;
    storeEvents.emit();
  },

  subscribe: storeEvents.subscribe,
};
