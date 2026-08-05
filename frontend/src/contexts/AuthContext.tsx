/**
 * Real AuthProvider for Stage 6 — replaces the Stage 4 minimal bootstrap.
 *
 * Provides:
 *  - status: "idle" | "authenticating" | "authenticated" | "restore_failed" | "error"
 *  - user: { id, portalRole, status } when authenticated
 *  - login(): redirect to Instagram OAuth
 *  - logout(): clear session, redirect to /
 *
 * Bootstrap on mount: try refresh cookie → fall back to dev-login (dev only).
 * Soft `/me` failures after a good refresh become `restore_failed` (Retry UI)
 * instead of dumping the user to login.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearImpersonationSession,
  refreshAccessToken,
  setAccessToken,
  getAccessToken,
  devLogin,
  fetchMe,
  logout as apiLogout,
  type MeResult,
} from "../api/auth";
import { API_BASE_URL } from "../api/config";
import type { PortalRole } from "../types/auth";

export type AuthStatus =
  | "idle"
  | "authenticating"
  | "authenticated"
  | "restore_failed"
  | "error";

export type AuthUser = {
  id: string;
  portalRole: PortalRole;
  status: string;
  instagramUsername?: string;
  /** Admin user id, set only while an admin is viewing as this user. */
  impersonatedBy?: string;
  /** Whether that impersonation session is barred from mutating. */
  impersonationReadonly?: boolean;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
  /** Re-fetch the current user (e.g. after an onboarding status transition). */
  refreshUser: () => Promise<AuthUser | null>;
  /**
   * Apply a password-login (or set-password) session atomically: bump the auth
   * generation first (so in-flight bootstrap cannot set `error`), install the
   * access token, then mark authenticated from the login payload (no `/me`).
   */
  acceptSession: (user: AuthUser, accessToken: string) => void;
  /**
   * Drop impersonation and re-mint the admin session from the refresh cookie
   * (SPA path). Caller should clear React Query before invoking. Returns whether
   * the admin user was restored.
   */
  restoreAdminFromCookie: () => Promise<boolean>;
  /** Re-run refresh + `/me` after a soft restore failure. */
  retryRestore: () => Promise<void>;
  /** Give up on soft restore and send the user through the login path. */
  abandonRestore: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** True when the browser is on a login/auth page (don't dev-auto-login there). */
function onAuthRoute(): boolean {
  const p = window.location.pathname;
  return (
    p === "/login" ||
    p.startsWith("/brand/login") ||
    p.startsWith("/brand/setup") ||
    p.startsWith("/brand/apply") ||
    p.startsWith("/brand/forgot-password") ||
    p.startsWith("/brand/reset-password") ||
    p.startsWith("/admin") ||
    p.startsWith("/auth/")
  );
}

/**
 * Public marketing/legal pages also skip auto-dev-login. Visiting `/` must stay
 * anonymous so Join Us → `/login` is testable; portal routes (`/org/*`, etc.)
 * still auto-login for local DX without Instagram.
 */
function onPublicMarketingRoute(): boolean {
  const p = window.location.pathname;
  return (
    p === "/" ||
    p.startsWith("/privacy") ||
    p.startsWith("/terms") ||
    p.startsWith("/data-deletion")
  );
}

async function fetchMeWithRetry(
  stillOwner: () => boolean,
): Promise<MeResult> {
  const first = await fetchMe();
  if (!stillOwner()) return first;
  if (first.kind !== "error") return first;
  return fetchMe();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<AuthUser | null>(null);
  const startedRef = useRef(false);
  // Latest known user (read inside async callbacks without re-creating them) and
  // a generation counter so a slow refreshUser can't overwrite a newer result.
  const userRef = useRef<AuthUser | null>(null);
  const genRef = useRef(0);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const failHard = useCallback(() => {
    setAccessToken(null);
    userRef.current = null;
    setUser(null);
    setStatus("error");
  }, []);

  const failSoft = useCallback(() => {
    // Keep access token — cookie/session may still be valid; Retry can recover.
    userRef.current = null;
    setUser(null);
    setStatus("restore_failed");
  }, []);

  const applyMeResult = useCallback(
    (me: MeResult, opts: { softOnTransient: boolean }): boolean => {
      if (me.kind === "user") {
        userRef.current = me.user;
        setUser(me.user);
        setStatus("authenticated");
        return true;
      }
      if (me.kind === "error" && opts.softOnTransient && getAccessToken()) {
        failSoft();
        return false;
      }
      failHard();
      return false;
    },
    [failHard, failSoft],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Capture generation at bootstrap start. Password login calls
    // acceptSession(), which bumps genRef first — a slow/failed bootstrap must
    // not clobber that session with status "error".
    const bootGen = genRef.current;
    const bootstrapStillOwner = () => genRef.current === bootGen;

    const bootstrap = async () => {
      setStatus("authenticating");
      const refreshed = await refreshAccessToken();
      if (!bootstrapStillOwner()) return;
      if (refreshed) {
        const me = await fetchMeWithRetry(bootstrapStillOwner);
        if (!bootstrapStillOwner()) return;
        if (me.kind === "user") {
          userRef.current = me.user;
          setUser(me.user);
          setStatus("authenticated");
          return;
        }
        // Refresh worked but /me did not yield a user — do not try dev-login
        // (that would rotate away a real cookie session). Soft vs hard below.
        if (!bootstrapStillOwner()) return;
        if (me.kind === "error") {
          failSoft();
          return;
        }
        failHard();
        return;
      }
      // Dev-only convenience: auto-login as the seeded org so local dev has a
      // session without the Instagram flow (dev-login 404s in prod). Skip it on
      // auth + public marketing routes — Join Us → /login must not bounce an
      // already-authenticated org to /org/browse.
      if (!onAuthRoute() && !onPublicMarketingRoute()) {
        const dev = await devLogin();
        if (!bootstrapStillOwner()) return;
        if (dev) {
          const me = await fetchMeWithRetry(bootstrapStillOwner);
          if (!bootstrapStillOwner()) return;
          if (me.kind === "user") {
            userRef.current = me.user;
            setUser(me.user);
            setStatus("authenticated");
            return;
          }
        }
      }
      if (!bootstrapStillOwner()) return;
      failHard();
    };
    void bootstrap().catch(() => {
      if (bootstrapStillOwner()) failHard();
    });
  }, [failHard, failSoft]);

  const login = useCallback(() => {
    // Redirect to Instagram OAuth login endpoint.
    // The backend responds with a 302 to Instagram; the browser follows it.
    // Single source of truth for the API base (so the prod-URL guard covers it).
    const apiBase = API_BASE_URL.replace(/\/$/, "");
    window.location.href = `${apiBase}/api/auth/instagram/login`;
  }, []);

  const logout = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    setStatus("idle");
    await apiLogout();
    window.location.href = "/";
  }, []);

  const refreshUser = useCallback(async () => {
    const gen = ++genRef.current;
    const result = await fetchMe();
    // Drop a stale result if a newer refreshUser started while we awaited (F3).
    if (gen !== genRef.current) return userRef.current;

    if (result.kind === "user") {
      setUser(result.user);
      setStatus("authenticated");
      return result.user;
    }
    if (result.kind === "unauthenticated") {
      setUser(null);
      setStatus("error");
      return null;
    }
    // Transient failure (network/5xx): keep the current session — a single
    // failed poll must not log a valid user out (F2).
    return userRef.current;
  }, []);

  const acceptSession = useCallback((next: AuthUser, accessToken: string) => {
    // Invalidate in-flight bootstrap / refreshUser BEFORE installing the token
    // so a late bootstrap cannot see "token present, no user" and race us.
    genRef.current += 1;
    setAccessToken(accessToken);
    userRef.current = next;
    setUser(next);
    setStatus("authenticated");
  }, []);

  const restoreAdminFromCookie = useCallback(async () => {
    const gen = ++genRef.current;
    clearImpersonationSession();
    userRef.current = null;
    setUser(null);
    setStatus("authenticating");

    const refreshed = await refreshAccessToken();
    if (gen !== genRef.current) return false;
    if (!refreshed) {
      failHard();
      return false;
    }

    const me = await fetchMeWithRetry(() => gen === genRef.current);
    if (gen !== genRef.current) return false;
    return applyMeResult(me, { softOnTransient: true });
  }, [applyMeResult, failHard]);

  const retryRestore = useCallback(async () => {
    const gen = ++genRef.current;
    setStatus("authenticating");
    const refreshed = await refreshAccessToken();
    if (gen !== genRef.current) return;
    if (!refreshed) {
      failHard();
      return;
    }
    const me = await fetchMeWithRetry(() => gen === genRef.current);
    if (gen !== genRef.current) return;
    applyMeResult(me, { softOnTransient: true });
  }, [applyMeResult, failHard]);

  const abandonRestore = useCallback(() => {
    genRef.current += 1;
    failHard();
  }, [failHard]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
      refreshUser,
      acceptSession,
      restoreAdminFromCookie,
      retryRestore,
      abandonRestore,
    }),
    [
      status,
      user,
      login,
      logout,
      refreshUser,
      acceptSession,
      restoreAdminFromCookie,
      retryRestore,
      abandonRestore,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    return {
      status: "idle",
      user: null,
      login: () => {},
      logout: async () => {},
      refreshUser: async () => null,
      acceptSession: () => {},
      restoreAdminFromCookie: async () => false,
      retryRestore: async () => {},
      abandonRestore: () => {},
    };
  }
  return ctx;
}
