/**
 * Per-drop "Notify Me" persistence backed by `localStorage` (PRODUCT.md §6.3:
 * Upcoming drops let an org request a notification when the drop opens; v1 is
 * UI-only with no backend write).
 *
 * Keys are namespaced under `buzz.v1.notify.<dropId>` to avoid colliding with the
 * mock data layer.
 */

const KEY_PREFIX = "buzz.v1.notify";
const DEFAULT_REMINDER_MINUTES = [15] as const;

type NotifyRecord = {
  enabled: boolean;
  reminderMinutes: number[];
};

function keyFor(dropId: string): string {
  return `${KEY_PREFIX}.${dropId}`;
}

function normalizeReminderMinutes(reminderMinutes: number[]): number[] {
  return Array.from(new Set(reminderMinutes))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);
}

function readRecord(dropId: string): NotifyRecord {
  if (typeof window === "undefined") {
    return { enabled: false, reminderMinutes: [] };
  }

  const raw = window.localStorage.getItem(keyFor(dropId));
  if (!raw) return { enabled: false, reminderMinutes: [] };

  // Backward compatibility for earlier boolean-only storage.
  if (raw === "1") {
    return { enabled: true, reminderMinutes: [...DEFAULT_REMINDER_MINUTES] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotifyRecord>;
    const reminderMinutes = normalizeReminderMinutes(
      Array.isArray(parsed.reminderMinutes)
        ? parsed.reminderMinutes.map(Number)
        : []
    );
    const enabled =
      typeof parsed.enabled === "boolean"
        ? parsed.enabled
        : reminderMinutes.length > 0;

    return {
      enabled,
      reminderMinutes: enabled ? reminderMinutes : [],
    };
  } catch {
    return { enabled: false, reminderMinutes: [] };
  }
}

/** Returns true when the user has opted into notifications for this drop. */
export function isDropNotified(dropId: string): boolean {
  try {
    return readRecord(dropId).enabled;
  } catch {
    return false;
  }
}

/** Returns selected lead times (in minutes) for this drop's reminders. */
export function getDropReminderMinutes(dropId: string): number[] {
  try {
    return readRecord(dropId).reminderMinutes;
  } catch {
    return [];
  }
}

/** Stores reminder selections and marks notify enabled if one or more are selected. */
export function setDropReminderMinutes(
  dropId: string,
  reminderMinutes: number[]
): void {
  try {
    if (typeof window === "undefined") return;
    const normalized = normalizeReminderMinutes(reminderMinutes);

    if (normalized.length === 0) {
      window.localStorage.removeItem(keyFor(dropId));
    } else {
      const record: NotifyRecord = {
        enabled: true,
        reminderMinutes: normalized,
      };
      window.localStorage.setItem(keyFor(dropId), JSON.stringify(record));
    }
    window.dispatchEvent(new StorageEvent("storage", { key: keyFor(dropId) }));
  } catch {
    /* ignore */
  }
}

/** Sets or clears the notification opt-in flag for this drop. */
export function setDropNotified(dropId: string, value: boolean): void {
  setDropReminderMinutes(dropId, value ? [...DEFAULT_REMINDER_MINUTES] : []);
}
