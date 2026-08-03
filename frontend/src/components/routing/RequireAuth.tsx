/**
 * RequireAuth — redirects to /login if not authenticated. Shows a spinner while
 * the auth bootstrap is still in flight.
 */
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { pathname } = useLocation();

  if (status === "authenticating" || status === "idle") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">Loading...</p>
      </div>
    );
  }

  if (status !== "authenticated") {
    // Admins can't sign in with Instagram, so /login would strand them.
    const target = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
