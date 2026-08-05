/**
 * SPA exit from admin "View as": clear impersonated query cache, navigate to
 * `/admin` while status is `authenticating`, then finish restoring the admin
 * session from the refresh cookie.
 *
 * Order is load-bearing: if restore fails *before* navigate, RequireAuth on
 * `/org/*` would send the user to `/login` (not `/admin/login`).
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
      const path =
        reason === "expired" ? "/admin?impersonation=expired" : "/admin";
      // Kick off restore (sync: clears impersonation + sets authenticating),
      // navigate immediately, then await the network work.
      const done = restoreAdminFromCookie();
      navigate(path, { replace: true });
      await done;
    },
    [queryClient, restoreAdminFromCookie, navigate],
  );
}
