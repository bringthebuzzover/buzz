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
import { setAccessToken, setImpersonationToken } from "../auth";
import { useAuth } from "../../contexts/AuthContext";
import { pathForUser } from "../../utils/landing";
import type { PortalRole } from "../../types/auth";

type UserPayload = {
  id: string;
  portal_role: string;
  status: string;
  instagram_username: string | null;
  email: string | null;
};

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

// ── Overview + health ───────────────────────────────────────────────────────

export type AdminQueue = {
  key: string;
  count: number;
  oldestAt: number | null;
};

export type AdminWarning = { key: string; count: number };

export type AdminOverview = {
  generatedAt: number;
  queues: AdminQueue[];
  warnings: AdminWarning[];
};

export function useAdminOverview(): AdminQuery<AdminOverview> {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const { data } = await apiFetch<AdminOverview>("/api/admin/overview");
      return data;
    },
  });
}

export type AdminSignal = {
  key: string;
  count: number;
  /** "Nothing to act on" — a zero count for most signals, but the informational
   * token buckets are always ok regardless of size. */
  ok: boolean;
  detail: string | null;
};

export type AdminHealth = {
  generatedAt: number;
  pipeline: AdminSignal[];
  instagramTokens: AdminSignal[];
  integrity: AdminSignal[];
  silent: AdminSignal[];
};

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

export type AdminOrgRow = {
  /** The `organizations` row. Null until the user submits their profile. */
  id: string | null;
  userId: string;
  orgName: string | null;
  university: string | null;
  instagramHandle: string | null;
  followerCount: number | null;
  memberCount: number | null;
  category: string | null;
  status: string;
  eduEmail: string | null;
  emailVerifiedAt: number | null;
  approvedAt: number | null;
  lastLoginAt: number | null;
  instagramTokenExpiresAt: number | null;
  impersonatable: boolean;
  createdAt: number;
};

export type AdminOrgDetail = AdminOrgRow & {
  orgId: string | null;
  instagramUsername: string | null;
  tiktokHandle: string | null;
  city: string | null;
  state: string | null;
  contactName: string | null;
  deliveryAddress: string | null;
  instagramTokenRefreshedAt: number | null;
  applications: { applied: number; accepted: number; denied: number };
  postCount: number;
  linkedPostCount: number;
  verification: {
    liveTokenCount: number;
    latestExpiresAt: number | null;
    latestUsedAt: number | null;
  };
};

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

export type AdminBrandRow = {
  id: string;
  userId: string;
  brandName: string;
  companyEmail: string;
  intentMessage: string | null;
  instagramHandle: string | null;
  /** `brands.status`, which disagrees with `userStatus` by design. */
  status: string;
  userStatus: string;
  passwordSet: boolean;
  approvedAt: number | null;
  lastLoginAt: number | null;
  impersonatable: boolean;
  createdAt: number;
};

// ── Drops ───────────────────────────────────────────────────────────────────

export type AdminDropRow = {
  id: string;
  brandId: string;
  brandName: string;
  brandStatus: string;
  title: string;
  stage: string;
  capacityTotal: number;
  totalProductUnits: number | null;
  appliedCount: number;
  acceptedCount: number;
  applyOpenAt: number;
  applyCloseAt: number;
  manualReopen: boolean;
  trackingNumber: string | null;
  campaignHashtag: string | null;
  finalizedAt: number | null;
  createdAt: number;
};

export type AdminBrandDetail = AdminBrandRow & {
  invite: {
    issuedAt: number | null;
    expiresAt: number | null;
    /** Stamped on redemption *and* when a re-issue supersedes the token, so read
     * it alongside `passwordSet`. */
    usedAt: number | null;
  };
  drops: AdminDropRow[];
};

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

export function useAdminDrops(params: {
  stage?: string;
  attention?: string;
}): AdminQuery<AdminDropRow[]> {
  const { stage, attention } = params;
  return useQuery({
    queryKey: ["admin", "drops", stage ?? "all", attention ?? "all"],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (stage) search.set("stage", stage);
      if (attention) search.set("attention", attention);
      const query = search.toString();
      const { data } = await apiFetch<AdminDropRow[]>(
        `/api/admin/drops${query ? `?${query}` : ""}`,
      );
      return data;
    },
  });
}

export type AdminApplicant = {
  id: string;
  orgId: string;
  userId: string;
  orgName: string;
  university: string;
  instagramHandle: string | null;
  followerCount: number | null;
  deliveryAddress: string | null;
  decision: string;
  allocatedUnits: number | null;
  pitch: string | null;
  trackingNumber: string | null;
  linkedPostCount: number;
  appliedAt: number;
  decisionAt: number | null;
};

export type AdminTrackerEvent = {
  id: string;
  stage: string;
  note: string | null;
  occurredAt: number;
};

export type AdminDropDetail = AdminDropRow & {
  brandInstagramHandle: string | null;
  description: string;
  image: string;
  location: string;
  allocatedUnits: number;
  linkedPostCount: number;
  pendingSuggestionCount: number;
  applicants: AdminApplicant[];
  trackerEvents: AdminTrackerEvent[];
};

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
  return useAdminMutation((orgId: string) =>
    apiFetch(`/api/admin/orgs/${orgId}/approve`, { method: "POST" }),
  );
}

export function useDenyOrg() {
  return useAdminMutation((orgId: string) =>
    apiFetch(`/api/admin/orgs/${orgId}/deny`, { method: "POST" }),
  );
}

export function useApproveBrand() {
  return useAdminMutation((brandId: string) =>
    apiFetch(`/api/admin/brands/${brandId}/approve`, { method: "POST" }),
  );
}

export function useCreateBrand() {
  return useAdminMutation(
    (input: {
      brandName: string;
      companyEmail: string;
      instagramHandle?: string;
      intentMessage?: string;
      approveNow?: boolean;
    }) =>
      apiFetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
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
  return useAdminMutation((brandId: string) =>
    apiFetch(`/api/admin/brands/${brandId}/resend-invite`, { method: "POST" }),
  );
}

export function useClearOrgInstagramToken() {
  return useAdminMutation((userId: string) =>
    apiFetch(`/api/admin/orgs/${userId}/clear-instagram-token`, {
      method: "POST",
    }),
  );
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

export function useImpersonate(): AdminMutation<string> {
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
