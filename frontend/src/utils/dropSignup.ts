import { allowlistedOAuthNext } from "./oauthNext";

export const DROP_PITCH_MAX_LENGTH = 2000;
const KEY = "buzz.dropSignup";
const TTL_MS = 24 * 60 * 60 * 1000;

/** One same-tab draft; pitch never enters URLs, OAuth state, or credentials. */
export function saveDropPitch(next: string, pitch: string): void {
  const allowed = allowlistedOAuthNext(next);
  if (!allowed || pitch.length > DROP_PITCH_MAX_LENGTH) throw new Error("Invalid drop draft.");
  sessionStorage.setItem(KEY, JSON.stringify({ next: allowed, pitch, expiresAt: Date.now() + TTL_MS }));
}

export function readDropPitch(next: string | null): string {
  if (!next || !allowlistedOAuthNext(next)) return "";
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return draft?.next === next && typeof draft.pitch === "string" &&
      draft.pitch.length <= DROP_PITCH_MAX_LENGTH && typeof draft.expiresAt === "number" &&
      draft.expiresAt > Date.now() && draft.expiresAt <= Date.now() + TTL_MS
      ? draft.pitch : "";
  } catch {
    return "";
  }
}

export function clearDropPitch(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* Submission already succeeded. */ }
}
