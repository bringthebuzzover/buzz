/**
 * RequireRole — 403 page if the authenticated user's portal role doesn't match.
 * Must be nested inside RequireAuth.
 */
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { PortalRole } from "../../types/auth";

type Props = {
  children: ReactNode;
  role: PortalRole;
};

export default function RequireRole({ children, role }: Props) {
  const { user } = useAuth();

  if (!user || user.portalRole !== role) {
    return (
      <div className="mx-auto max-w-lg px-8 py-24 text-center">
        <h1 className="mb-4 text-4xl font-black text-buzz-coral">403</h1>
        <p className="text-sm font-medium text-buzz-inkMuted">
          You don't have access to this page with your current account.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
