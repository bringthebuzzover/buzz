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

/** sessionStorage latch so reconnect framing survives token_version bump. */
export const INSTAGRAM_RECONNECT_LATCH = "buzz.instagramReconnect";

export function markInstagramReconnectLatch(): void {
  sessionStorage.setItem(INSTAGRAM_RECONNECT_LATCH, "1");
}

export function clearInstagramReconnectLatch(): void {
  sessionStorage.removeItem(INSTAGRAM_RECONNECT_LATCH);
}

export function hasInstagramReconnectLatch(): boolean {
  return sessionStorage.getItem(INSTAGRAM_RECONNECT_LATCH) === "1";
}

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
 * Drop the in-memory impersonation bearer. Does not navigate and does not touch
 * the admin refresh cookie.
 */
export function clearImpersonationSession(): void {
  accessToken = null;
  impersonating = false;
}

/**
 * End impersonation via full document load to `/admin`.
 *
 * Prefer the React hook `useEndImpersonation` in UI (SPA restore + query cache
 * clear). This hard path remains for non-React callers such as `apiFetch`, which
 * must not import Router or QueryClient.
 */
export function endImpersonation(reason?: "expired"): void {
  clearImpersonationSession();
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
      // Refresh 200 rotated token_version / cookie — always adopt the new
      // access JWT, even if login installed a bearer mid-flight (that bearer
      // is dead after this rotation). Failure paths above still respect
      // tokenAtStart so a 401 does not wipe a concurrent login.
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

async function _errorCode(resp: Response): Promise<string | undefined> {
  try {
    const body = (await resp.json()) as { error?: { code?: string } };
    return body.error?.code;
  } catch {
    return undefined;
  }
}

function _instagramReconnect(): MeResult {
  markInstagramReconnectLatch();
  return { kind: "instagram_reconnect" };
}

/**
 * Result of {@link fetchMe}, distinguishing a *definitively unauthenticated*
 * session (401 the refresh cookie can't rescue) from a *transient* failure
 * (network blip / 5xx), and from Instagram reconnect (IG token expired).
 * Callers must NOT log a user out on `"error"` — only on `"unauthenticated"` —
 * otherwise a single failed 15s poll bounces a valid session to /login.
 */
export type MeResult =
  | { kind: "user"; user: AuthUser }
  | { kind: "unauthenticated" }
  | { kind: "instagram_reconnect" }
  | { kind: "error" };

/**
 * Fetch the current user from GET /api/auth/me.
 *
 * On a Buzz access-token 401 it refreshes once from the cookie and retries.
 * ``INSTAGRAM_TOKEN_EXPIRED`` is distinct: Meta cannot refresh an already-
 * expired IG token, so we never refresh-and-hope — return
 * ``instagram_reconnect`` and set the sessionStorage latch.
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
      const code = await _errorCode(resp);
      if (code === "INSTAGRAM_TOKEN_EXPIRED") {
        return _instagramReconnect();
      }
      if (!(await refreshAccessToken())) return { kind: "unauthenticated" };
      const refreshed = getAccessToken();
      if (!refreshed) return { kind: "unauthenticated" };
      resp = await _meRequest(refreshed);
    }
    if (resp.status === 401) {
      const code = await _errorCode(resp);
      if (code === "INSTAGRAM_TOKEN_EXPIRED") {
        return _instagramReconnect();
      }
      return { kind: "unauthenticated" };
    }
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
