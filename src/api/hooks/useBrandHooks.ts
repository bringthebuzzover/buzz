/**
 * TanStack Query hooks for brand-side API endpoints.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { useAuth } from "../../contexts/AuthContext";
import type { components } from "../generated/schema";

// ── Types matching backend camelCase responses ──────────────────────────

// Sourced from the backend OpenAPI spec (run `npm run gen:api`), so a backend
// change to GET /api/brands/me's response shape becomes a TypeScript error here
// instead of a silent runtime drift. This is the pattern to copy as more
// endpoints adopt the typed `DataResponse[T]` envelope.
export type BrandProfile =
  components["schemas"]["BrandProfileResponse"];

export type BrandDropItem = {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  description: string;
  image: string;
  location: string;
  capacityTotal: number;
  applyOpenAt: number;
  applyCloseAt: number;
  manualReopen: boolean;
  brandTrackerStage: string;
  totalProductUnits: number | null;
  campaignHashtag: string | null;
  applicantSelectionFinalizedAt: number | null;
  createdAt: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalEngagement: number;
  totalReach: number;
};

export type BrandDropDetail = BrandDropItem & {
  applications: BrandDropApplicant[];
};

export type BrandDropApplicant = {
  id: string;
  dropId: string;
  orgId: string;
  decision: string;
  pitch: string | null;
  trackingNumber: string | null;
  allocatedUnits: number | null;
  appliedAt: number;
  decisionAt: number | null;
  orgName: string;
  university: string;
  instagramHandle: string;
  followerCount: number | null;
  memberCount: number | null;
  attributedPostCount: number;
  attributedLikes: number;
  attributedComments: number;
  attributedEngagement: number;
};

export type BrandAggregate = {
  totalDrops: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalEngagement: number;
  totalReach: number;
  totalOrgs: number;
  totalCampuses: number;
};

export type EngagementPoint = {
  timestamp: number;
  engagement: number;
};

// ── Hooks ────────────────────────────────────────────────────────────────

export function useBrandProfile() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandProfile>("/api/brands/me");
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useBrandDrops() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-drops"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandDropItem[]>("/api/brands/me/drops");
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useBrandDropDetail(dropId: string | undefined) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-drop-detail", dropId],
    queryFn: async () => {
      const { data } = await apiFetch<BrandDropDetail>(
        `/api/brands/me/drops/${dropId}`,
      );
      return data;
    },
    enabled: status === "authenticated" && !!dropId,
  });
}

export function useBrandAggregate() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-aggregate"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandAggregate>(
        "/api/brands/me/aggregate",
      );
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useEngagementSeries(bucketCount = 12, windowDays = 14) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["engagement-series", bucketCount, windowDays],
    queryFn: async () => {
      const { data } = await apiFetch<EngagementPoint[]>(
        `/api/brands/me/engagement-series?bucket_count=${bucketCount}&window_days=${windowDays}`,
      );
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useCreateBrandDrop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; description: string }) => {
      const { data } = await apiFetch<BrandDropItem>("/api/brands/me/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-drops"] });
      queryClient.invalidateQueries({ queryKey: ["brand-aggregate"] });
    },
  });
}

export function useFinalizeApplicants(dropId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allocations: { orgId: string; units: number }[]) => {
      const { data } = await apiFetch(
        `/api/brands/me/drops/${dropId}/finalize-applicants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allocations }),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-drop-detail", dropId] });
      queryClient.invalidateQueries({ queryKey: ["brand-drops"] });
    },
  });
}
