/**
 * TanStack Query hooks for the admin panel.
 *
 * Wire format follows the rest of the API: `TokenResponse` / `UserResponse` stay
 * snake_case (`access_token`, `portal_role`) because they predate the convention,
 * while every panel payload is camelCase with epoch-ms datetimes (serialized by
 * `CamelModel`), so nothing is remapped here.
 *
 * Every mutation invalidates the whole `["admin"]` key space. The sidebar badges
 * read from the overview query, so an approve that left a stale badge behind
 * would be worse than one extra refetch on a page only a few people open.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../client";
import { setImpersonationToken, setViewAsLatch } from "../auth";
import { useAuth } from "../../contexts/AuthContext";
import { pathForUser } from "../../utils/landing";
import type { components } from "../generated/schema";

export type TokenResponse = components["schemas"]["TokenResponse"];
export type UserResponse = components["schemas"]["UserResponse"];
export type ImpersonateResponse = components["schemas"]["ImpersonateResponse"];

/**
 * The slice of a TanStack query result the panel reads.
 *
 * Every hook below annotates its return type with this rather than letting it be
 * inferred, because the app still compiles on TypeScript 4.9 (CRA's pin) while
 * `@tanstack/react-query` v5 types need 5.4+. Under `skipLibCheck` the mismatch
 * degrades `useQuery`'s generics to `any` instead of erroring, which is why the
 * older pages annotate their `.map` callbacks by hand. Declaring the shape here
 * keeps the admin pages type-safe without spreading `any` through their JSX, and
 * stays correct if the TypeScript pin is ever lifted.
 */
export type AdminQuery<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
};

export type AdminMutation<TInput> = {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<unknown>;
  isPending: boolean;
  isError: boolean;
};

export function useAdminLogin(): AdminMutation<{
  email: string;
  password: string;
}> {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await apiFetch<TokenResponse>("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!data.access_token) {
        throw new ApiError(
          "INTERNAL_ERROR",
          "Login response missing access token.",
          500,
        );
      }
      // Token is installed atomically in acceptSession (with gen bump) so
      // AuthProvider bootstrap cannot race between setAccessToken and auth state.
      return data;
    },
  });
}

// ── Overview + health ───────────────────────────────────────────────────────

export type AdminQueue = components["schemas"]["AdminQueueItem"];
export type AdminWarning = components["schemas"]["AdminWarningItem"];
export type AdminOverview = components["schemas"]["AdminOverviewResponse"];

export function useAdminOverview(): AdminQuery<AdminOverview> {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const { data } = await apiFetch<AdminOverview>("/api/admin/overview");
      return data;
    },
  });
}

export type AdminSignal = components["schemas"]["AdminSignal"];
export type AdminHealth = components["schemas"]["AdminHealthResponse"];

export function useAdminHealth(): AdminQuery<AdminHealth> {
  return useQuery({
    queryKey: ["admin", "health"],
    queryFn: async () => {
      const { data } = await apiFetch<AdminHealth>("/api/admin/health");
      return data;
    },
  });
}

// ── Organizations ───────────────────────────────────────────────────────────

/** The `organizations` row. Null until the user submits their profile. */
export type AdminOrgRow = components["schemas"]["AdminOrgItem"];
export type AdminOrgDetail = components["schemas"]["AdminOrgDetail"];

export function useAdminOrgs(status?: string): AdminQuery<AdminOrgRow[]> {
  return useQuery({
    queryKey: ["admin", "orgs", status ?? "all"],
    queryFn: async () => {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const { data } = await apiFetch<AdminOrgRow[]>(`/api/admin/orgs${query}`);
      return data;
    },
  });
}

/** Keyed on the *user* id — a profileless account has no org row to key on. */
export function useAdminOrg(
  userId: string | undefined,
): AdminQuery<AdminOrgDetail> {
  return useQuery({
    queryKey: ["admin", "org", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await apiFetch<AdminOrgDetail>(
        `/api/admin/orgs/${userId}`,
      );
      return data;
    },
  });
}

// ── Brands ──────────────────────────────────────────────────────────────────

/** `brands.status` disagrees with `userStatus` by design. */
export type AdminBrandRow = components["schemas"]["AdminBrandItem"];
export type AdminBrandDetail = components["schemas"]["AdminBrandDetail"];

// ── Drops ───────────────────────────────────────────────────────────────────

export type AdminDropRow = components["schemas"]["AdminDropItem"];

export function useAdminBrands(status?: string): AdminQuery<AdminBrandRow[]> {
  return useQuery({
    queryKey: ["admin", "brands", status ?? "all"],
    queryFn: async () => {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const { data } = await apiFetch<AdminBrandRow[]>(
        `/api/admin/brands${query}`,
      );
      return data;
    },
  });
}

export function useAdminBrand(
  brandId: string | undefined,
): AdminQuery<AdminBrandDetail> {
  return useQuery({
    queryKey: ["admin", "brand", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const { data } = await apiFetch<AdminBrandDetail>(
        `/api/admin/brands/${brandId}`,
      );
      return data;
    },
  });
}

// ── Drop requests (intake tickets) ──────────────────────────────────────────

export type AdminDropRequest = components["schemas"]["AdminDropRequestItem"];

export function useAdminDropRequests(params?: {
  status?: string;
  brandId?: string;
}): AdminQuery<AdminDropRequest[]> {
  const status = params?.status;
  const brandId = params?.brandId;
  return useQuery({
    queryKey: ["admin", "drop-requests", status ?? "all", brandId ?? "all"],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (status) search.set("status", status);
      if (brandId) search.set("brand_id", brandId);
      const query = search.toString();
      const { data } = await apiFetch<AdminDropRequest[]>(
        `/api/admin/drop-requests${query ? `?${query}` : ""}`,
      );
      return data;
    },
  });
}

export function useAdminDropRequest(
  requestId: string | undefined,
): AdminQuery<AdminDropRequest> {
  return useQuery({
    queryKey: ["admin", "drop-request", requestId],
    enabled: Boolean(requestId),
    queryFn: async () => {
      const { data } = await apiFetch<AdminDropRequest>(
        `/api/admin/drop-requests/${requestId}`,
      );
      return data;
    },
  });
}

export function useAdminDrops(params: {
  stage?: readonly string[];
  attention?: readonly string[];
  published?: "draft" | "published" | null;
}): AdminQuery<AdminDropRow[]> {
  const stages = [...(params.stage ?? [])];
  const attentions = [...(params.attention ?? [])];
  const published = params.published ?? null;
  return useQuery({
    queryKey: ["admin", "drops", stages, attentions, published ?? "all"],
    queryFn: async () => {
      const search = new URLSearchParams();
      for (const value of stages) search.append("stage", value);
      for (const value of attentions) search.append("attention", value);
      if (published) search.set("published", published);
      const query = search.toString();
      const { data } = await apiFetch<AdminDropRow[]>(
        `/api/admin/drops${query ? `?${query}` : ""}`,
      );
      return data;
    },
  });
}

export type AdminApplicant = components["schemas"]["AdminApplicantItem"];
export type AdminTrackerEvent = components["schemas"]["AdminTrackerEventItem"];
export type AdminDropDetail = components["schemas"]["AdminDropDetail"];

export function useAdminDrop(
  dropId: string | undefined,
): AdminQuery<AdminDropDetail> {
  return useQuery({
    queryKey: ["admin", "drop", dropId],
    enabled: Boolean(dropId),
    queryFn: async () => {
      const { data } = await apiFetch<AdminDropDetail>(
        `/api/admin/drops/${dropId}`,
      );
      return data;
    },
  });
}

// ── Lifecycle mutations ─────────────────────────────────────────────────────

/** Drop every admin query, so no badge or list can disagree with the database. */
function invalidateAdmin(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["admin"] });
}

function useAdminMutation<TInput>(
  request: (input: TInput) => Promise<unknown>,
): AdminMutation<TInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

/** Takes the `organizations` id — the approve/deny routes key on the profile. */
export function useApproveOrg() {
  return useAdminMutation(
    (input: { orgId: string; testerInviteConfirmed: boolean }) =>
      apiFetch(`/api/admin/orgs/${input.orgId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testerInviteConfirmed: input.testerInviteConfirmed,
        }),
      }),
  );
}

export function useResendOrgConnect() {
  return useAdminMutation((orgId: string) =>
    apiFetch(`/api/admin/orgs/${orgId}/resend-connect`, { method: "POST" }),
  );
}

export function useDenyOrg() {
  return useAdminMutation((orgId: string) =>
    apiFetch(`/api/admin/orgs/${orgId}/deny`, { method: "POST" }),
  );
}

export type BrandInviteActionResult =
  components["schemas"]["AdminBrandInviteResponse"];

/** Admin copy when approve/create succeeded but the invite mail did not. */
export const INVITE_EMAIL_FAILED_COPY =
  "Brand approved, but the invite email failed to send. Open the brand and use Resend invite.";

export function useApproveBrand() {
  return useAdminMutation(async (brandId: string) => {
    const { data } = await apiFetch<BrandInviteActionResult>(
      `/api/admin/brands/${brandId}/approve`,
      { method: "POST" },
    );
    return data;
  });
}

export function useCreateBrand() {
  return useAdminMutation(
    async (input: {
      brandName: string;
      companyEmail: string;
      instagramHandle?: string;
      intentMessage?: string;
      approveNow?: boolean;
    }) => {
      const { data } = await apiFetch<BrandInviteActionResult>(
        "/api/admin/brands",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      return data;
    },
  );
}

export function useDenyBrand() {
  return useAdminMutation((brandId: string) =>
    apiFetch(`/api/admin/brands/${brandId}/deny`, { method: "POST" }),
  );
}

export function useUndenyOrg() {
  return useAdminMutation((orgId: string) =>
    apiFetch(`/api/admin/orgs/${orgId}/undeny`, { method: "POST" }),
  );
}

export function useUndenyBrand() {
  return useAdminMutation((brandId: string) =>
    apiFetch(`/api/admin/brands/${brandId}/undeny`, { method: "POST" }),
  );
}

export function useResendBrandInvite() {
  return useAdminMutation(async (brandId: string) => {
    const { data } = await apiFetch<BrandInviteActionResult>(
      `/api/admin/brands/${brandId}/resend-invite`,
      { method: "POST" },
    );
    return data;
  });
}

export function useClearOrgInstagramToken() {
  return useAdminMutation((userId: string) =>
    apiFetch(`/api/admin/orgs/${userId}/clear-instagram-token`, {
      method: "POST",
    }),
  );
}

export type AdminOrgEraseResult =
  components["schemas"]["AdminOrgEraseResponse"];

/** Hybrid erase — confirm is the org's Instagram handle (PRODUCT §3.1.2). */
export function useEraseOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; confirm: string }) => {
      const { data } = await apiFetch<AdminOrgEraseResult>(
        `/api/admin/orgs/${input.userId}/erase`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: input.confirm }),
        },
      );
      return data;
    },
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useClearReopen(dropId: string) {
  return useAdminMutation((_: void) =>
    apiFetch(`/api/admin/drops/${dropId}/clear-reopen`, { method: "POST" }),
  );
}

export function useSetDropTracking(dropId: string) {
  return useAdminMutation((trackingNumber: string) =>
    apiFetch(`/api/admin/drops/${dropId}/tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingNumber }),
    }),
  );
}

export type AdminDropConfigPatch = {
  capacityTotal?: number;
  applyOpenAt?: number;
  applyCloseAt?: number;
  totalProductUnits?: number | null;
  campaignHashtag?: string | null;
  title?: string;
  description?: string;
  image?: string;
  location?: string;
};

export type AdminDropCreateInput = {
  brandId: string;
  title: string;
  description: string;
  image: string;
  location: string;
  capacityTotal: number;
  applyOpenAt: number;
  applyCloseAt: number;
  totalProductUnits?: number | null;
  campaignHashtag?: string | null;
  dropRequestId?: string;
};

export function useCreateAdminDrop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminDropCreateInput) => {
      const { brandId, ...body } = input;
      const { data } = await apiFetch<AdminDropDetail>(
        `/api/admin/brands/${brandId}/drops`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return data;
    },
    onSuccess: (data, input) => {
      // Seed before the fan-out refetch so Publish does not wait on every
      // ["admin"] query (staleTime 30s). Do not await invalidate — that was
      // blocking mutateAsync and leaving the stub disabled
      // (admin.publish-disabled-after-draft).
      if (data?.id) {
        queryClient.setQueryData(["admin", "drop", data.id], data);
        if (input.dropRequestId) {
          queryClient.setQueryData(
            ["admin", "drop-request", input.dropRequestId],
            (old: AdminDropRequest | undefined) =>
              old
                ? { ...old, convertedDropId: data.id, status: "converted" }
                : old,
          );
        }
      }
      void invalidateAdmin(queryClient);
    },
  });
}

export function usePublishDrop(dropId: string) {
  return useAdminMutation((_: void) =>
    apiFetch(`/api/admin/drops/${dropId}/publish`, { method: "POST" }),
  );
}

export function usePatchAdminDropConfig(dropId: string) {
  return useAdminMutation((payload: AdminDropConfigPatch) =>
    apiFetch(`/api/admin/drops/${dropId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export function useAdvanceTracker(dropId: string) {
  return useAdminMutation(
    (input: { stage: string; trackingNumber?: string; note?: string }) =>
      apiFetch(`/api/admin/drops/${dropId}/tracker`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: input.stage,
          trackingNumber: input.trackingNumber || null,
          note: input.note || null,
        }),
      }),
  );
}

export function useReopenDrop(dropId: string) {
  return useAdminMutation((_: void) =>
    apiFetch(`/api/admin/drops/${dropId}/reopen`, { method: "POST" }),
  );
}

// ── Impersonation ───────────────────────────────────────────────────────────

export type AdminUserRow = components["schemas"]["AdminUserItem"];

export function useImpersonate(): AdminMutation<string> {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiFetch<ImpersonateResponse>(
        `/api/admin/impersonate/${userId}`,
        { method: "POST" },
      );
      // Swaps the in-memory bearer only; the admin's refresh cookie is left
      // alone so "Exit impersonation" restores the admin session. Latch lets
      // same-tab reload remint View as.
      const role = data.user.portal_role;
      if (role === "org" || role === "brand") {
        setViewAsLatch(data.user.id, role);
      }
      setImpersonationToken(data.accessToken);
      return data;
    },
  });
}

/**
 * The full "View as" sequence, shared by every surface that offers it.
 *
 * The order is load-bearing and easy to get wrong: mint the token, then clear
 * the query cache *before* resolving the new identity, or data fetched as the
 * admin renders inside the target's portal. Then land wherever that user belongs.
 */
export function useViewAs() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const impersonate = useImpersonate();
  const [error, setError] = useState<string | null>(null);

  const viewAs = useCallback(
    async (userId: string) => {
      setError(null);
      try {
        await impersonate.mutateAsync(userId);
        queryClient.clear();
        const me = await refreshUser();
        navigate(me ? pathForUser(me) : "/", { replace: true });
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not start impersonation.",
        );
      }
    },
    [impersonate, queryClient, refreshUser, navigate],
  );

  return { viewAs, error, isPending: impersonate.isPending };
}
