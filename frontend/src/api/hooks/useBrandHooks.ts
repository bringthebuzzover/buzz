/**
 * TanStack Query hooks for brand-side API endpoints.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { useAuth } from "../../contexts/AuthContext";
import type { components } from "../generated/schema";

// Sourced from OpenAPI (`npm run gen:api`) via DataResponse[T] payloads.
export type BrandProfile = components["schemas"]["BrandProfileResponse"];
export type BrandDropItem = components["schemas"]["BrandDropListItem"];
export type BrandDropDetail = components["schemas"]["BrandDropDetailResponse"];
export type BrandDropPost = components["schemas"]["BrandDropPostItem"];
export type BrandDropApplicant = components["schemas"]["BrandDropDetailApplicant"];
export type BrandAggregate = components["schemas"]["BrandAggregateResponse"];
export type EngagementPoint = components["schemas"]["EngagementSeriesPoint"];
export type BrandDropRequest = components["schemas"]["BrandDropRequestResponse"];

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

export function useBrandDropRequests() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-drop-requests"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandDropRequest[]>(
        "/api/brands/me/drop-requests",
      );
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

export function useCreateBrandDropRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { message: string; notes?: string }) => {
      const { data } = await apiFetch<BrandDropRequest>(
        "/api/brands/me/drop-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-drop-requests"] });
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
