/**
 * TanStack Query hooks for drop endpoints (org-side drops + apply).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { useAuth } from "../../contexts/AuthContext";

export type DropFeedItem = {
  id: string;
  brandName: string;
  title: string;
  description: string;
  image: string;
  location: string;
  capacityTotal: number;
  applyOpenAt: number;
  applyCloseAt: number;
  manualReopen: boolean;
  acceptedCount: number;
  alreadyApplied: boolean;
};

export type DropDetail = DropFeedItem & {
  brandId: string;
  totalProductUnits: number | null;
  createdAt: number;
};

export type DropApplication = {
  id: string;
  dropId: string;
  orgId: string;
  decision: string;
  pitch: string | null;
  trackingNumber: string | null;
  allocatedUnits: number | null;
  appliedAt: number;
  decisionAt: number | null;
};

export function useOrgDropFeed() {
  const { status } = useAuth();
  const query = useQuery({
    queryKey: ["org-drop-feed"],
    queryFn: async () => {
      const { data } = await apiFetch<DropFeedItem[]>("/api/drops");
      return data;
    },
    enabled: status === "authenticated",
  });

  const authError =
    status === "error" ? new Error("Authentication failed.") : null;

  return {
    items: query.data ?? [],
    isLoading: status === "authenticating" || query.isLoading,
    error: authError ?? query.error,
  };
}

export function useDropDetail(dropId: string | undefined) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["drop-detail", dropId],
    queryFn: async () => {
      const { data } = await apiFetch<DropDetail>(`/api/drops/${dropId}`);
      return data;
    },
    enabled: status === "authenticated" && !!dropId,
  });
}

export function useApplyToDrop(dropId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pitch?: string) => {
      const { data } = await apiFetch<DropApplication>(
        `/api/drops/${dropId}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pitch: pitch ?? null }),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-drop-feed"] });
      queryClient.invalidateQueries({ queryKey: ["drop-detail", dropId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
