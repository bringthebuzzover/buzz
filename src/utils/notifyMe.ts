/**
 * Per-drop "Notify Me" persistence backed by `localStorage` (PRODUCT.md §6.3:
 * Upcoming drops let an org request a notification when the drop opens; v1 is
 * UI-only with no backend write).
 *
 * Keys are namespaced under `buzz.v1.notify.<dropId>` to avoid colliding with the
 * mock data layer.
 */

const KEY_PREFIX = "buzz.v1.notify";

function keyFor(dropId: string): string {
  return `${KEY_PREFIX}.${dropId}`;
}

/** Returns true when the user has opted into notifications for this drop. */
export function isDropNotified(dropId: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(keyFor(dropId)) === "1";
  } catch {
    return false;
  }
}

/** Sets or clears the notification opt-in flag for this drop. */
export function setDropNotified(dropId: string, value: boolean): void {
  try {
    if (typeof window === "undefined") return;
    if (value) {
      window.localStorage.setItem(keyFor(dropId), "1");
    } else {
      window.localStorage.removeItem(keyFor(dropId));
    }
    // Cross-component awareness in the same tab.
    window.dispatchEvent(new StorageEvent("storage", { key: keyFor(dropId) }));
  } catch {
    /* ignore */
  }
}
