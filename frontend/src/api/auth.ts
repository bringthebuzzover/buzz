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
import type { components } from "./generated/schema";

type LoginData = components["schemas"]["TokenResponse"];
type RefreshData = components["schemas"]["RefreshResponse"];
type UserWire = components["schemas"]["UserResponse"];

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

/**
 * Same-tab View-as intent. Access JWT stays memory-only; after reload bootstrap
 * remints via POST /impersonate when this latch is present on a portal URL.
 */
export const VIEW_AS_LATCH = "buzz.viewAsTarget";
/** Independent of the ~15m impersonation access TTL. */
export const VIEW_AS_LATCH_TTL_MS = 8 * 60 * 60 * 1000;

export type ViewAsLatch = {
  userId: string;
  portalRole: "org" | "brand";
  setAt: number;
};

export function setViewAsLatch(
  userId: string,
  portalRole: "org" | "brand",
): void {
  const payload: ViewAsLatch = { userId, portalRole, setAt: Date.now() };
  sessionStorage.setItem(VIEW_AS_LATCH, JSON.stringify(payload));
}

export function clearViewAsLatch(): void {
  sessionStorage.removeItem(VIEW_AS_LATCH);
}

/** Null when missing, corrupt, or past latch TTL (also removes bad/expired). */
export function peekViewAsLatch(): ViewAsLatch | null {
  const raw = sessionStorage.getItem(VIEW_AS_LATCH);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ViewAsLatch>;
    if (
      typeof parsed.userId !== "string" ||
      (parsed.portalRole !== "org" && parsed.portalRole !== "brand") ||
      typeof parsed.setAt !== "number"
    ) {
      clearViewAsLatch();
      return null;
    }
    if (Date.now() - parsed.setAt > VIEW_AS_LATCH_TTL_MS) {
      clearViewAsLatch();
      return null;
    }
    return {
      userId: parsed.userId,
      portalRole: parsed.portalRole,
      setAt: parsed.setAt,
    };
  } catch {
    clearViewAsLatch();
    return null;
  }
}

/** Portal role implied by a View-as resume URL, or null if not a portal path. */
export function viewAsPortalRoleFromPath(
  pathname: string,
): "org" | "brand" | null {
  if (pathname === "/org" || pathname.startsWith("/org/")) return "org";
  if (pathname === "/brand" || pathname.startsWith("/brand/")) return "brand";
  return null;
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * User returned by the most recent successful ``resumeImpersonation``. Same
 * intent as ``lastRefreshedUser`` for the impersonation path: the imp endpoint
 * mints the token and serializes the target user from the same transaction,
 * so bootstrap can skip a follow-up ``/me`` that would race a
 * ``token_version`` bump (auth.ci-session-restore-flake). Single-use.
 */
let lastImpersonatedUser: AuthUser | null = null;

export function takeImpersonatedUser(): AuthUser | null {
  const u = lastImpersonatedUser;
  lastImpersonatedUser = null;
  return u;
}

/**
 * Re-mint View as using the current admin bearer. Does not touch the latch
 * (caller clears on failure). Returns whether an impersonation token was
 * installed. On success also stashes the target user for
 * {@link takeImpersonatedUser}.
 */
export async function resumeImpersonation(userId: string): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const resp = await fetch(
      `${API_BASE_URL}/api/admin/impersonate/${userId}`,
      {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!resp.ok) return false;
    // ImpersonateResponse uses camelCase (accessToken); legacy snake_case
    // fallback kept for older mocks. ``user`` is always present in the current
    // schema and mirrors what ``GET /me`` would return for the target.
    const body = (await resp.json()) as {
      data:
        | {
            accessToken?: string;
            access_token?: string;
            user?: UserWire;
          }
        | null;
    };
    const access = body.data?.accessToken ?? body.data?.access_token;
    if (!access) return false;
    setImpersonationToken(access);
    lastImpersonatedUser = body.data?.user
      ? authUserFromWire(body.data.user)
      : null;
    return true;
  } catch {
    lastImpersonatedUser = null;
    return false;
  }
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
 * Drop the in-memory impersonation bearer and View-as latch. Does not navigate
 * and does not touch the admin refresh cookie.
 */
export function clearImpersonationSession(): void {
  accessToken = null;
  impersonating = false;
  clearViewAsLatch();
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

/** One retry when `fetch` throws (dropped connection). HTTP status is not retried. */
async function fetchWithOneThrowRetry(
  input: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return await fetch(input, init);
  }
}

/** Exchange the refresh cookie for a fresh access token. Returns success. */
let refreshInFlight: Promise<boolean> | null = null;
/** Access token observed when the current in-flight refresh began. */
let refreshInFlightStartedWith: string | null = null;
/**
 * User returned by the most recent successful ``/refresh``. The refresh
 * response carries the same ``UserResponse`` payload as ``/me`` (built in the
 * same transaction), so bootstrap can consume this and skip a follow-up
 * ``/me`` — that follow-up was the mint-then-read race in
 * ``gaps/auth.ci-session-restore-flake.md``. Callers must ``take`` the value
 * (single-use) so a stale user from an earlier refresh never resurfaces.
 */
let lastRefreshedUser: AuthUser | null = null;

/**
 * Consume + clear the user from the most recent successful ``refreshAccessToken``.
 * Returns ``null`` if refresh hasn't run yet or if the response lacked a user
 * field (e.g. older mocks in tests). Single-use.
 */
export function takeRefreshedUser(): AuthUser | null {
  const u = lastRefreshedUser;
  lastRefreshedUser = null;
  return u;
}

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
      const resp = await fetchWithOneThrowRetry(
        `${API_BASE_URL}/api/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!resp.ok) {
        if (accessToken === tokenAtStart) setAccessToken(null);
        lastRefreshedUser = null;
        return false;
      }
      const body = (await resp.json()) as { data: RefreshData | null };
      if (!body.data?.access_token) {
        if (accessToken === tokenAtStart) setAccessToken(null);
        lastRefreshedUser = null;
        return false;
      }
      // Refresh 200 rotated token_version / cookie — always adopt the new
      // access JWT, even if login installed a bearer mid-flight (that bearer
      // is dead after this rotation). Failure paths above still respect
      // tokenAtStart so a 401 does not wipe a concurrent login.
      setAccessToken(body.data.access_token);
      // Same-transaction user body → bootstrap consumes via takeRefreshedUser
      // and skips /me. Guard against schema drift / older mocks.
      lastRefreshedUser = body.data.user ? authUserFromWire(body.data.user) : null;
      return true;
    } catch {
      if (accessToken === tokenAtStart) setAccessToken(null);
      lastRefreshedUser = null;
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
    const resp = await fetchWithOneThrowRetry(
      `${API_BASE_URL}/api/auth/dev-login`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
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
 * Map a wire ``UserResponse`` (snake_case, backend contract) to the SPA's
 * ``AuthUser`` (camelCase). Shared by ``fetchMe``, the ``/refresh`` user
 * inlining, and the dev-login user inlining
 * (auth.ci-session-restore-flake). Exported so bootstrap can consume the
 * user body returned by dev-login without a follow-up ``/me``.
 */
export function authUserFromWire(u: UserWire): AuthUser {
  return {
    id: u.id,
    portalRole: u.portal_role as AuthUser["portalRole"],
    status: u.status,
    instagramUsername: u.instagram_username ?? undefined,
    email: u.email ?? undefined,
    pendingEduEmail: u.pending_edu_email ?? undefined,
    impersonatedBy: u.impersonated_by ?? undefined,
    impersonationReadonly: u.impersonation_readonly ?? undefined,
  };
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
      // Refreshing here would hand back the admin's own token. Clock-expired
      // View-as ends; ver-mismatch must not — remint from the latch on reload.
      if (impersonating) {
        const impCode = await _errorCode(resp);
        if (impCode === "TOKEN_EXPIRED") {
          endImpersonation("expired");
          return { kind: "unauthenticated" };
        }
        return { kind: "error" };
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
    const body = (await resp.json()) as { data: UserWire | null };
    const u = body.data;
    if (!u) return { kind: "error" };
    return { kind: "user", user: authUserFromWire(u) };
  } catch {
    return { kind: "error" }; // network throw → transient
  }
}

/** Clear the server-side refresh cookie (and revoke when Bearer is known). */
export async function logout(accessTokenOverride?: string | null): Promise<void> {
  try {
    const headers: HeadersInit = {};
    const token =
      accessTokenOverride !== undefined ? accessTokenOverride : getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers,
    });
  } catch {
    // Best-effort — client clears local state regardless.
  }
}
