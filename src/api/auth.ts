/**
 * Frontend session state for the Stage 4 slice.
 *
 * The Buzz access token lives **in memory only** (architecture §5.3 — never
 * `localStorage`, to keep it off the XSS surface). The refresh token rides an
 * httpOnly cookie, so `refreshAccessToken` and `devLogin` use `credentials:
 * "include"` and never touch the token directly.
 *
 * These helpers use raw `fetch` (not `apiFetch`) on purpose: they must not pass
 * through the 401→refresh interceptor in `client.ts` (that would recurse).
 *
 * NOTE (Stage 6): the real `AuthProvider` + OAuth login/callback replace the
 * `devLogin` bootstrap; the in-memory token store and `refreshAccessToken`
 * carry over unchanged.
 */
import { API_BASE_URL } from "./config";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type LoginData = {
  access_token: string;
  user?: { id: string; portal_role: string; status: string };
};

/** Exchange the refresh cookie for a fresh access token. Returns success. */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!resp.ok) {
      setAccessToken(null);
      return false;
    }
    const body = (await resp.json()) as { data: { access_token: string } | null };
    if (!body.data?.access_token) {
      setAccessToken(null);
      return false;
    }
    setAccessToken(body.data.access_token);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

/** Dev-only: mint a session for a seeded org user (404 outside development). */
export async function devLogin(): Promise<LoginData | null> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!resp.ok) {
      return null;
    }
    const body = (await resp.json()) as { data: LoginData | null };
    if (body.data?.access_token) {
      setAccessToken(body.data.access_token);
    }
    return body.data;
  } catch {
    // Backend unreachable (e.g. uvicorn not running) — treat as a failed login.
    return null;
  }
}
