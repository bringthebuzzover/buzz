/**
 * RequireAuth — redirects to login if not authenticated. Shows restore UI while
 * bootstrap is in flight or when `/me` failed softly after a good refresh.
 */
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { onboardingQuery } from "../../utils/oauthNext";
import AuthPending from "../auth/AuthPending";
import SessionRestorePanel from "./SessionRestorePanel";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { pathname, search } = useLocation();

  if (status === "authenticating" || status === "idle") {
    return <AuthPending label="Loading…" />;
  }

  if (status === "restore_failed") {
    return <SessionRestorePanel />;
  }

  if (status === "needs_instagram_reconnect") {
    return <Navigate to="/reconnect-instagram" replace />;
  }

  if (status !== "authenticated") {
    // Admins can't sign in with Instagram, so /login would strand them.
    const target = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    const params = new URLSearchParams(search);
    return <Navigate to={target + onboardingQuery(params.get("next"), params.get("prefill"))} replace />;
  }

  return <>{children}</>;
}
