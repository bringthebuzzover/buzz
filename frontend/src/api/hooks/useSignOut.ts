/**
 * Same action as the header Logout control: exit View-as when impersonating,
 * otherwise POST /api/auth/logout and return home.
 */
import { useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useEndImpersonation } from "./useEndImpersonation";

export function useSignOut(): () => void {
  const { user, logout } = useAuth();
  const endImpersonation = useEndImpersonation();

  return useCallback(() => {
    if (user?.impersonatedBy) {
      void endImpersonation();
      return;
    }
    void logout();
  }, [user?.impersonatedBy, endImpersonation, logout]);
}
