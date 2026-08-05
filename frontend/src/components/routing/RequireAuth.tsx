/**
 * RequireAuth — redirects to login if not authenticated. Shows restore UI while
 * bootstrap is in flight or when `/me` failed softly after a good refresh.
 */
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import SessionRestorePanel from "./SessionRestorePanel";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { pathname } = useLocation();

  if (status === "authenticating" || status === "idle") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">
          Restoring your session…
        </p>
      </div>
    );
  }

  if (status === "restore_failed") {
    return <SessionRestorePanel />;
  }

  if (status !== "authenticated") {
    // Admins can't sign in with Instagram, so /login would strand them.
    const target = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
