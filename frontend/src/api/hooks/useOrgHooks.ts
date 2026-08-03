/**
 * TanStack Query hooks for org-side API endpoints.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { useAuth } from "../../contexts/AuthContext";

// ── Types matching backend camelCase responses ──────────────────────────

export type OrgProfile = {
  id: string;
  orgName: string;
  university: string;
  eduEmail: string;
  instagramHandle: string;
  tiktokHandle: string | null;
  followerCount: number | null;
  memberCount: number | null;
  city: string | null;
  state: string | null;
  contactName: string | null;
  deliveryAddress: string | null;
  approvedAt: number | null;
  createdAt: number;
};

export type PostItem = {
  id: string;
  orgId: string;
  platform: string;
  externalId: string;
  url: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string;
  mediaType: string;
  mediaProductType: string;
  postedAt: number;
  likes: number;
  comments: number;
  reach: number | null;
  views: number | null;
  saved: number | null;
  shares: number | null;
  reposts: number | null;
  totalInteractions: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
  follows: number | null;
  igReelsAvgWatchTime: number | null;
  igReelsVideoViewTotalTime: number | null;
  reelsSkipRate: number | null;
  metricsUpdatedAt: number | null;
  createdAt: number;
  linkedApplicationId: string | null;
  linkedDropId: string | null;
};

export type CampaignItem = {
  id: string;
  dropId: string;
  decision: string;
  pitch: string | null;
  trackingNumber: string | null;
  allocatedUnits: number | null;
  appliedAt: number;
  decisionAt: number | null;
  title: string;
  brandName: string;
  brandTrackerStage: string;
  image: string;
};

export type CampaignDetail = CampaignItem & {
  orgId: string;
  description: string | null;
  applyOpenAt: number;
  applyCloseAt: number;
  capacityTotal: number;
  totalProductUnits: number | null;
};

export type CampaignAggregate = {
  postCount: number;
  likes: number;
  comments: number;
  engagement: number;
  estimatedReach: number;
};

export type Suggestion = {
  postId: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  postedAt: number;
  likes: number;
  comments: number;
  matchReason: string;
  matchEvidence: string;
};

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
