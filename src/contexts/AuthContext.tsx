/**
 * Minimal auth bootstrap for the Stage 4 vertical slice.
 *
 * This is intentionally tiny — it exists only so the migrated slice can obtain a
 * real session. On mount it tries the refresh cookie, then (in dev) falls back
 * to `POST /api/auth/dev-login`. It is mounted only when `USE_API` is on, so the
 * demo path is untouched.
 *
 * Stage 6 replaces this with the real `AuthProvider` + OAuth login/callback
 * pages and `RequireAuth`/`RequireRole`/`RequireStatus` guards.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { devLogin, refreshAccessToken } from "../api/auth";

export type AuthStatus =
  | "idle"
  | "authenticating"
  | "authenticated"
  | "error";

type AuthContextValue = {
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("idle");
  const startedRef = useRef(false);

  useEffect(() => {
    // `startedRef` dedupes the StrictMode double-invoke. We intentionally do NOT
    // cancel on cleanup: the single in-flight bootstrap must always resolve to a
    // terminal status, otherwise a guarded-out re-invocation would strand the
    // spinner. Setting state after an unmount is a harmless no-op in React 18.
    if (startedRef.current) return;
    startedRef.current = true;

    const bootstrap = async () => {
      setStatus("authenticating");
      // Prefer an existing refresh-cookie session; fall back to dev-login.
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        setStatus("authenticated");
        return;
      }
      const dev = await devLogin();
      setStatus(dev ? "authenticated" : "error");
    };
    void bootstrap().catch(() => setStatus("error"));
  }, []);

  return (
    <AuthContext.Provider value={{ status }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    // The slice mounts AuthProvider only when USE_API is on; treat an absent
    // provider as "not authenticated" so demo-path callers never crash.
    return { status: "idle" };
  }
  return ctx;
}
