/**
 * RequireRole — block portal pages when the authenticated user's portal role
 * does not match. Admins stranded on /org/* or /brand/* (e.g. View-as resume
 * failed) redirect to /admin instead of an inline 403. Cross-portal org↔brand
 * mismatch still shows 403.
 */
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { PortalRole } from "../../types/auth";

type Props = {
  children: ReactNode;
  role: PortalRole;
};

export default function RequireRole({ children, role }: Props) {
  const { user } = useAuth();

  if (!user || user.portalRole !== role) {
    if (user?.portalRole === "admin") {
      return <Navigate to="/admin" replace />;
    }
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
