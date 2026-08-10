/**
 * TanStack Query hooks for org-side API endpoints.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { useAuth } from "../../contexts/AuthContext";
import type { components } from "../generated/schema";

export type OrgProfile = components["schemas"]["OrgProfileResponse"];
/** Editable PATCH body for `PATCH /api/orgs/me` (omit unchanged fields). */
export type OrgProfileUpdate = components["schemas"]["OrgProfileUpdate"];
export type PostItem = components["schemas"]["PostResponse"];
export type CampaignItem = components["schemas"]["CampaignListItem"];
export type CampaignDetail = components["schemas"]["CampaignDetailResponse"];
export type CampaignAggregate = components["schemas"]["CampaignAggregateResponse"];
export type Suggestion = components["schemas"]["SuggestionResponse"];

// ── Hooks ────────────────────────────────────────────────────────────────

export function useOrgProfile() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["org-profile"],
    queryFn: async () => {
      const { data } = await apiFetch<OrgProfile>("/api/orgs/me");
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useUpdateOrgProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OrgProfileUpdate) => {
      const { data } = await apiFetch<OrgProfile>("/api/orgs/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["org-profile"], data);
    },
  });
}

export function useOrgPosts() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["org-posts"],
    queryFn: async () => {
      const { data } = await apiFetch<PostItem[]>("/api/orgs/me/posts");
      return data;
    },
    enabled: status === "authenticated",
  });
}

/** Reloads the stored post list from Buzz (does not pull from Meta/Instagram). */
export function useRefreshOrgPosts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiFetch<PostItem[]>("/api/orgs/me/posts/refresh", {
        method: "POST",
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["org-posts"], data);
    },
  });
}

export function useCampaigns() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data } = await apiFetch<CampaignItem[]>("/api/campaigns");
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useCampaignDetail(applicationId: string | undefined) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["campaign-detail", applicationId],
    queryFn: async () => {
      const { data } = await apiFetch<CampaignDetail>(
        `/api/campaigns/${applicationId}`,
      );
      return data;
    },
    enabled: status === "authenticated" && !!applicationId,
  });
}

export function useCampaignAggregate(applicationId: string | undefined) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["campaign-aggregate", applicationId],
    queryFn: async () => {
      const { data } = await apiFetch<CampaignAggregate>(
        `/api/campaigns/${applicationId}/aggregate`,
      );
      return data;
    },
    enabled: status === "authenticated" && !!applicationId,
  });
}

export function useSuggestions(applicationId: string | undefined) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["suggestions", applicationId],
    queryFn: async () => {
      const { data } = await apiFetch<Suggestion[]>(
        `/api/campaigns/${applicationId}/suggestions`,
      );
      return data;
    },
    enabled: status === "authenticated" && !!applicationId,
  });
}

export function useLinkPost(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data } = await apiFetch<PostItem>(
        `/api/campaigns/${applicationId}/link-post`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-aggregate", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["suggestions", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["org-posts"] });
    },
  });
}

export function useUnlinkPost(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      await apiFetch<void>(`/api/campaigns/${applicationId}/link-post`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-aggregate", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["suggestions", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["org-posts"] });
    },
  });
}

export function useAcceptSuggestion(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      await apiFetch(
        `/api/campaigns/${applicationId}/suggestions/${postId}/accept`,
        { method: "POST" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-aggregate", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["suggestions", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["org-posts"] });
    },
  });
}

export function useDismissSuggestion(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      await apiFetch(
        `/api/campaigns/${applicationId}/suggestions/${postId}/dismiss`,
        { method: "POST" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions", applicationId] });
    },
  });
}
