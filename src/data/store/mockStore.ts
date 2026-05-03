/**
 * Generic localStorage adapter for the demo's mock data layer.
 *
 * - All keys are namespaced under `buzz.v1.*`.
 * - A schema version is stored under `buzz.v1.__version` so that bumping `STORE_VERSION`
 *   forces a one-time reseed (see `seedAll.ts`).
 * - Reads are tolerant of malformed JSON (return the provided default).
 * - Writes are wrapped in try/catch and notify subscribers on success.
 *
 * Stores are designed to be used with `useSyncExternalStore` for tear-free reads.
 */

/** Bumping this triggers a one-time reseed of the entire mock data layer. */
export const STORE_VERSION = 1;

/** Single namespace prefix. Keep `buzz.v1.*` so future `buzz.v2.*` migrations are clean. */
export const STORE_KEY_PREFIX = "buzz.v1";

/** Key used for the schema version sentinel. */
export const STORE_VERSION_KEY = `${STORE_KEY_PREFIX}.__version`;

type Listener = () => void;

/**
 * Lightweight pub/sub used by every entity store so React's `useSyncExternalStore`
 * can re-render when storage changes (including same-tab writes).
 */
class StoreEventBus {
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  emit = (): void => {
    for (const listener of this.listeners) {
      listener();
    }
  };
}

/** Single global bus shared by all stores; per-store filtering is unnecessary in v1. */
export const storeEvents = new StoreEventBus();

/** Cross-tab sync: when localStorage changes elsewhere, fan out to subscribers here. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key.startsWith(STORE_KEY_PREFIX)) {
      storeEvents.emit();
    }
  });
}

/** Builds a fully-qualified storage key for an entity (e.g. `buzz.v1.drops`). */
export function storeKey(entity: string): string {
  return `${STORE_KEY_PREFIX}.${entity}`;
}

/** Tolerant JSON read; returns `fallback` on missing / malformed values. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

/** Safe JSON write; emits store events on success. */
export function writeJSON<T>(key: string, value: T): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
    storeEvents.emit();
  } catch {
    /* quota or disabled storage — silently degrade */
  }
}

/** Returns the persisted schema version, or `null` if uninitialized. */
export function readStoreVersion(): number | null {
  return readJSON<number | null>(STORE_VERSION_KEY, null);
}

/** Persists the current schema version (called by the seed runner). */
export function writeStoreVersion(version: number): void {
  writeJSON(STORE_VERSION_KEY, version);
}

/**
 * Wipes every key in the namespace. Used by `resetAndReseed()` for demo recovery.
 * Iterates over a snapshot of the keys so removal during iteration is safe.
 */
export function clearAllNamespacedKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORE_KEY_PREFIX)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
    storeEvents.emit();
  } catch {
    /* ignore */
  }
}
