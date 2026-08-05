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
// True while the in-memory token is an admin impersonation token. The refresh
// cookie still belongs to the *admin*, so refreshing during impersonation would
// silently promote the session back to admin while the UI still reads as the
// target user. Callers must check this before refreshing.
let impersonating = false;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Swap in an impersonation token minted by `POST /api/admin/impersonate/:id`. */
export function setImpersonationToken(token: string): void {
  accessToken = token;
  impersonating = true;
}

export function isImpersonating(): boolean {
  return impersonating;
}

/**
 * Drop the impersonation token and return to the admin session.
 *
 * A full page load (rather than SPA navigation) is deliberate: it discards the
 * impersonated user's cached query data, and the bootstrap in `AuthProvider`
 * re-derives the admin session from the untouched refresh cookie.
 */
export function endImpersonation(reason?: "expired"): void {
  accessToken = null;
  impersonating = false;
  const suffix = reason === "expired" ? "?impersonation=expired" : "";
  window.location.href = `/admin${suffix}`;
}

type LoginData = {
  access_token: string;
  user?: { id: string; portal_role: string; status: string };
};

/** Exchange the refresh cookie for a fresh access token. Returns success. */
let refreshInFlight: Promise<boolean> | null = null;
/** Access token observed when the current in-flight refresh began. */
let refreshInFlightStartedWith: string | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    // Login may install a token+cookie while bootstrap's refresh (started with
    // no cookie) is still in flight. Joining that stale promise would resolve
    // false and look like logout. Waiting and then starting a *new* refresh
    // would rotate token_version and invalidate the login access token mid
    // fetchMe — so if a newer token is already present, keep it.
    if (accessToken !== refreshInFlightStartedWith) {
      await refreshInFlight;
      return accessToken !== null;
    }
    return refreshInFlight;
  }
  // If login (or another caller) installs a token while this refresh is in
  // flight, a 401/empty response must not wipe that newer session.
  const tokenAtStart = accessToken;
  refreshInFlightStartedWith = tokenAtStart;
  refreshInFlight = (async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) {
        if (accessToken === tokenAtStart) setAccessToken(null);
        return false;
      }
      const body = (await resp.json()) as { data: { access_token: string } | null };
      if (!body.data?.access_token) {
        if (accessToken === tokenAtStart) setAccessToken(null);
        return false;
      }
      setAccessToken(body.data.access_token);
      return true;
    } catch {
      if (accessToken === tokenAtStart) setAccessToken(null);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
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
 * Result of {@link fetchMe}, distinguishing a *definitively unauthenticated*
 * session (401 the refresh cookie can't rescue) from a *transient* failure
 * (network blip / 5xx). Callers must NOT log a user out on `"error"` — only on
 * `"unauthenticated"` — otherwise a single failed 15s poll bounces a valid
 * session to /login.
 */
export type MeResult =
  | { kind: "user"; user: AuthUser }
  | { kind: "unauthenticated" }
  | { kind: "error" };

/**
 * Fetch the current user from GET /api/auth/me.
 *
 * On a 401 (expired access token) it refreshes once from the cookie and retries,
 * so long-lived sessions (e.g. the pending-approval poller) survive the access-
 * token TTL while the refresh cookie is still valid. A still-401 after refresh is
 * `"unauthenticated"`; a 5xx or network throw is `"error"` (transient).
 * Uses raw fetch (not `apiFetch`) to avoid an import cycle with `client.ts`.
 */
export async function fetchMe(): Promise<MeResult> {
  try {
    let token = getAccessToken();
    if (!token) {
      if (impersonating) {
        endImpersonation("expired");
        return { kind: "unauthenticated" };
      }
      if (!(await refreshAccessToken())) return { kind: "unauthenticated" };
      token = getAccessToken();
      if (!token) return { kind: "unauthenticated" };
    }

    let resp = await _meRequest(token);
    if (resp.status === 401) {
      // Refreshing here would hand back the admin's own token, so an expired
      // impersonation ends the session instead of silently escalating it.
      if (impersonating) {
        endImpersonation("expired");
        return { kind: "unauthenticated" };
      }
      if (!(await refreshAccessToken())) return { kind: "unauthenticated" };
      const refreshed = getAccessToken();
      if (!refreshed) return { kind: "unauthenticated" };
      resp = await _meRequest(refreshed);
    }
    if (resp.status === 401) return { kind: "unauthenticated" };
    if (!resp.ok) return { kind: "error" }; // 5xx / other → transient, keep session
    const body = await resp.json();
    const u = body.data;
    if (!u) return { kind: "error" };
    return {
      kind: "user",
      user: {
        id: u.id,
        portalRole: u.portalRole ?? u.portal_role,
        status: u.status,
        instagramUsername: u.instagramUsername ?? u.instagram_username,
        impersonatedBy: u.impersonatedBy ?? u.impersonated_by ?? undefined,
        impersonationReadonly:
          u.impersonationReadonly ?? u.impersonation_readonly ?? undefined,
      },
    };
  } catch {
    return { kind: "error" }; // network throw → transient
  }
}

/** Clear the server-side refresh cookie (and revoke when Bearer is known). */
export async function logout(): Promise<void> {
  try {
    const headers: HeadersInit = {};
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers,
    });
  } catch {
    // Best-effort — token is already cleared client-side.
  }
}
