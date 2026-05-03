/**
 * One-time seed runner. Compares the persisted store version against `STORE_VERSION`
 * and reseeds when missing or stale. Also exposes `resetAndReseed()` for demo recovery.
 *
 * Idempotent on re-call within the same session (returns early when version is current).
 */

import { applicationsStore } from "./applicationsStore";
import { brandTrackerStore } from "./brandTrackerStore";
import { dropsStore } from "./dropsStore";
import { linksStore } from "./linksStore";
import { postsStore } from "./postsStore";
import {
  STORE_VERSION,
  clearAllNamespacedKeys,
  readStoreVersion,
  writeStoreVersion,
} from "./mockStore";

import { buildSeedDrops } from "../seed/seedDrops";
import { buildSeedApplications } from "../seed/seedApplications";
import { buildSeedPosts } from "../seed/seedPosts";
import { buildSeedLinks } from "../seed/seedLinks";
import { buildSeedTrackerEvents } from "../seed/seedBrandTracker";

function writeAllSeeds(now: number): void {
  dropsStore.replaceAll(buildSeedDrops(now));
  applicationsStore.replaceAll(buildSeedApplications(now));
  postsStore.replaceAll(buildSeedPosts(now));
  linksStore.replaceAll(buildSeedLinks(now));
  brandTrackerStore.replaceAll(buildSeedTrackerEvents(now));
}

/**
 * Runs once on app boot. If storage already has the current version, this is a
 * no-op. Otherwise it clears the namespace, writes fresh seeds anchored to "now",
 * and bumps the version sentinel.
 */
export function ensureSeeded(): void {
  const persisted = readStoreVersion();
  if (persisted === STORE_VERSION) {
    return;
  }
  clearAllNamespacedKeys();
  const now = Date.now();
  writeAllSeeds(now);
  writeStoreVersion(STORE_VERSION);
}

/**
 * Demo recovery: nukes the namespace and reseeds from scratch. Safe to wire to a
 * "Reset demo" button if one is added later. Also invalidates each store cache so
 * subscribed components re-render with the fresh data.
 */
export function resetAndReseed(): void {
  clearAllNamespacedKeys();
  const now = Date.now();
  writeAllSeeds(now);
  writeStoreVersion(STORE_VERSION);
  dropsStore.invalidate();
  applicationsStore.invalidate();
  postsStore.invalidate();
  linksStore.invalidate();
  brandTrackerStore.invalidate();
}
