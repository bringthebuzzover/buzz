import { DEFAULT_DEMO_ACCESS_PASSCODE } from "../data/demoAccess";

/**
 * Demo access gate — session storage + passcode from `REACT_APP_DEMO_ACCESS_CODE` (optional).
 * Dev fallback: `DEFAULT_DEMO_ACCESS_PASSCODE` in `data/demoAccess.ts`.
 */
export const DEMO_SESSION_KEY = "buzz_demo_active";

/** Stored when the demo passcode matches; restored on reload for this tab session. */
export const DEMO_SESSION_VALUE = "1";

/** Passcode from env, trimmed; dev fallback for local use. */
export function getDemoAccessPasscode(): string {
  const fromEnv = process.env.REACT_APP_DEMO_ACCESS_CODE?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_DEMO_ACCESS_PASSCODE;
}
