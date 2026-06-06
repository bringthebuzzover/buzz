/**
 * Frontend session state (Stage 6 — expanded from Stage 4 slice).
 *
 * The Buzz access token lives **in memory only** (architecture §5.3 — never
 * `localStorage`, to keep it off the XSS surface). The refresh token rides an
 * httpOnly cookie.
 *
 * These helpers use raw `fetch` (not `apiFetch`) on purpose: they must not pass
 * through the 401→refresh interceptor in `client.ts` (that would recurse).
 */
import { API_BASE_URL } from "./config";
import type { AuthUser } from "../contexts/AuthContext";

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
    if (!resp.ok) return null;
    const body = (await resp.json()) as { data: LoginData | null };
    if (body.data?.access_token) {
      setAccessToken(body.data.access_token);
    }
    return body.data;
  } catch {
    return null;
  }
}

async function _meRequest(token: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
}

/**
 * Fetch the current user from GET /api/auth/me. Returns null on failure.
 *
 * On a 401 (expired access token) it refreshes once from the cookie and retries,
 * so long-lived sessions (e.g. the pending-approval poller) don't get kicked to
 * /login after the 1h access-token TTL while the refresh cookie is still valid.
 * Uses raw fetch (not `apiFetch`) to avoid an import cycle with `client.ts`.
 */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    let token = getAccessToken();
    if (!token) {
      if (!(await refreshAccessToken())) return null;
      token = getAccessToken();
      if (!token) return null;
    }

    let resp = await _meRequest(token);
    if (resp.status === 401) {
      if (!(await refreshAccessToken())) return null;
      const refreshed = getAccessToken();
      if (!refreshed) return null;
      resp = await _meRequest(refreshed);
    }
    if (!resp.ok) return null;

    const body = await resp.json();
    const u = body.data;
    if (!u) return null;
    return {
      id: u.id,
      portalRole: u.portalRole ?? u.portal_role,
      status: u.status,
      instagramUsername: u.instagramUsername ?? u.instagram_username,
    };
  } catch {
    return null;
  }
}

/** Clear the server-side refresh cookie. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort — token is already cleared client-side.
  }
}
