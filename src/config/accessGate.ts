import { DEFAULT_DEMO_ACCESS_PASSCODE } from "../data/demoAccess";
import { isDemoView, type DemoView } from "../types/access";

/**
 * Demo access gate — session storage + passcode from `REACT_APP_DEMO_ACCESS_CODE` (optional).
 * Dev fallback: `DEFAULT_DEMO_ACCESS_PASSCODE` in `data/demoAccess.ts`.
 */
export const DEMO_SESSION_KEY = "buzz_demo_active";

/** Stored when the demo passcode matches; restored on reload for this tab session. */
export const DEMO_SESSION_VALUE = "1";

/** Stores which portal the demo session is currently emulating ("brand" | "org"). */
export const DEMO_VIEW_SESSION_KEY = "buzz_demo_view";

/** Passcode from env, trimmed; dev fallback for local use. */
export function getDemoAccessPasscode(): string {
  const fromEnv = process.env.REACT_APP_DEMO_ACCESS_CODE?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_DEMO_ACCESS_PASSCODE;
}

/** Safe sessionStorage read; returns null if storage unavailable or value invalid. */
export function readDemoViewFromStorage(): DemoView | null {
  try {
    const raw = sessionStorage.getItem(DEMO_VIEW_SESSION_KEY);
    return isDemoView(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Safe sessionStorage write; passing null clears the stored view. */
export function writeDemoViewToStorage(view: DemoView | null): void {
  try {
    if (view == null) {
      sessionStorage.removeItem(DEMO_VIEW_SESSION_KEY);
    } else {
      sessionStorage.setItem(DEMO_VIEW_SESSION_KEY, view);
    }
  } catch {
    /* in-memory only */
  }
}

/**
 * Landing route per demo view. Centralized so the future Drop Feed / Brand Dashboard
 * route renames only need to be changed in one place.
 */
export const DEMO_VIEW_LANDING: Record<DemoView, string> = {
  brand: "/brand/dashboard",
  org: "/org/drops",
};
