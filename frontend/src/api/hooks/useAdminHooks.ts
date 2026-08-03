/**
 * TanStack Query hooks for the admin console: password login, the user list,
 * and impersonation.
 *
 * Wire format matches the rest of the auth surface — `TokenResponse` /
 * `UserResponse` stay snake_case (`access_token`, `portal_role`), while the
 * admin list rows are camelCase (serialized by `CamelModel`).
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { setAccessToken, setImpersonationToken } from "../auth";
import type { PortalRole } from "../../types/auth";

type UserPayload = {
  id: string;
  portal_role: string;
  status: string;
  instagram_username: string | null;
  email: string | null;
};

export function useAdminLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await apiFetch<{
        access_token: string;
        user: UserPayload;
      }>("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      setAccessToken(data.access_token);
      return data;
    },
  });
}

export type AdminUserRow = {
  id: string;
  portalRole: PortalRole;
  status: string;
  displayName: string | null;
  email: string | null;
  instagramHandle: string | null;
  impersonatable: boolean;
  createdAt: number;
};

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data } = await apiFetch<AdminUserRow[]>("/api/admin/users");
      return data;
    },
  });
}

export function useImpersonate() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiFetch<{
        accessToken: string;
        user: UserPayload;
        readonly: boolean;
      }>(`/api/admin/impersonate/${userId}`, { method: "POST" });
      // Swaps the in-memory bearer only; the admin's refresh cookie is left
      // alone so "Exit impersonation" restores the admin session.
      setImpersonationToken(data.accessToken);
      return data;
    },
  });
}
