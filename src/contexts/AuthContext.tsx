/**
 * Real AuthProvider for Stage 6 — replaces the Stage 4 minimal bootstrap.
 *
 * Provides:
 *  - status: "idle" | "authenticating" | "authenticated" | "error"
 *  - user: { id, portalRole, status } when authenticated
 *  - login(): redirect to Instagram OAuth
 *  - logout(): clear session, redirect to /
 *
 * Bootstrap on mount: try refresh cookie → fall back to dev-login (dev only).
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
  refreshAccessToken,
  setAccessToken,
  devLogin,
  fetchMe,
  logout as apiLogout,
} from "../api/auth";
import type { PortalRole } from "../types/auth";

export type AuthStatus =
  | "idle"
  | "authenticating"
  | "authenticated"
  | "error";

export type AuthUser = {
  id: string;
  portalRole: PortalRole;
  status: string;
  instagramUsername?: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
  /** Re-fetch the current user (e.g. after an onboarding status transition). */
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<AuthUser | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const bootstrap = async () => {
      setStatus("authenticating");
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const me = await fetchMe();
        if (me) {
          setUser(me);
          setStatus("authenticated");
          return;
        }
      }
      const dev = await devLogin();
      if (dev) {
        const me = await fetchMe();
        // Only "authenticated" when we actually resolved a user; a token with
        // no /me would otherwise let RequireRole 403 a valid session.
        if (me) {
          setUser(me);
          setStatus("authenticated");
          return;
        }
      }
      setStatus("error");
    };
    void bootstrap().catch(() => setStatus("error"));
  }, []);

  const login = useCallback(() => {
    // Redirect to Instagram OAuth login endpoint.
    // The backend responds with a 302 to Instagram; the browser follows it.
    const apiBase = (
      process.env.REACT_APP_API_URL ?? "http://localhost:8000"
    ).replace(/\/$/, "");
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
    const me = await fetchMe();
    setUser(me);
    // Keep status in sync so guards (RequireAuth) see the post-login state.
    // Used after a brand login (client-side nav, no full reload) and after an
    // onboarding status transition.
    setStatus(me ? "authenticated" : "error");
    return me;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, refreshUser }),
    [status, user, login, logout, refreshUser],
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
    };
  }
  return ctx;
}
