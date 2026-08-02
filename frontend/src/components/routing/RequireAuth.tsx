/**
 * RequireAuth — redirects to /login if not authenticated. Shows a spinner while
 * the auth bootstrap is still in flight.
 */
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "authenticating" || status === "idle") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">Loading...</p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
