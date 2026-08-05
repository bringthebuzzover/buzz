/**
 * SPA exit from admin "View as": clear impersonated query cache, restore the
 * admin session from the refresh cookie, navigate to /admin — no full reload.
 *
 * `apiFetch` still uses `endImpersonation()` (hard navigation) because it cannot
 * import Router or QueryClient.
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";

export function useEndImpersonation(): (reason?: "expired") => Promise<void> {
  const { restoreAdminFromCookie } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(
    async (reason?: "expired") => {
      queryClient.clear();
      await restoreAdminFromCookie();
      const path =
        reason === "expired" ? "/admin?impersonation=expired" : "/admin";
      navigate(path, { replace: true });
    },
    [queryClient, restoreAdminFromCookie, navigate],
  );
}
