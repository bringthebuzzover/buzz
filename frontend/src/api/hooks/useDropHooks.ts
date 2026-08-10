/**
 * TanStack Query hooks for drop endpoints (org-side drops + apply).
 */
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { apiFetch, type ApiResult } from "../client";
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
  notifyRequested: boolean;
  reminderMinutes: number | null;
  /** Set when brand finalized picks — feed treats as closed for new applies. */
  applicantSelectionFinalizedAt: number | null;
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

/** One `GET /api/drops` page: the rows plus the envelope's pagination meta. */
type DropFeedPage = ApiResult<DropFeedItem[]>;

const DROP_FEED_KEY = ["org-drop-feed"];
const DROP_FEED_PAGE_SIZE = 50;

/**
 * Paged drop feed. The catalog can outgrow one page, so pages accumulate
 * behind `fetchNextPage` and `meta.total` decides when there is nothing left
 * to load (rather than silently truncating at the API default).
 */
export function useOrgDropFeed() {
  const { status } = useAuth();
  const query = useInfiniteQuery({
    queryKey: DROP_FEED_KEY,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiFetch<DropFeedItem[]>(
        `/api/drops?page=${pageParam}&per_page=${DROP_FEED_PAGE_SIZE}`,
      ),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.data.length, 0);
      const total = lastPage.meta?.total ?? loaded;
      return loaded < total ? allPages.length + 1 : undefined;
    },
    enabled: status === "authenticated",
  });

  const authError =
    status === "error" ? new Error("Authentication failed.") : null;

  return {
    items: query.data?.pages.flatMap((page) => page.data) ?? [],
    isLoading: status === "authenticating" || query.isLoading,
    error: authError ?? query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
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
    onSuccess: async () => {
      // Optimistic flip so the feed card shows "Already applied" before the
      // refetch lands (E2E and UX both race the invalidate otherwise).
      const markApplied = (feed: InfiniteData<DropFeedPage> | undefined) =>
        feed && {
          ...feed,
          pages: feed.pages.map((page) => ({
            ...page,
            data: page.data.map((row) =>
              row.id === dropId ? { ...row, alreadyApplied: true } : row,
            ),
          })),
        };
      queryClient.setQueryData<InfiniteData<DropFeedPage>>(
        DROP_FEED_KEY,
        markApplied,
      );
      await queryClient.invalidateQueries({ queryKey: DROP_FEED_KEY });
      // Re-assert after refetch: a stale/incorrect alreadyApplied=false from the
      // server must not wipe the successful apply state in the UI.
      queryClient.setQueryData<InfiniteData<DropFeedPage>>(
        DROP_FEED_KEY,
        markApplied,
      );
      await queryClient.invalidateQueries({ queryKey: ["drop-detail", dropId] });
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

/** Allowed reminder lead times (mirrors backend `_REMINDER_CHOICES`). */
export const REMINDER_CHOICES = [5, 15, 60] as const;

/**
 * Set/clear a "Notify Me" reminder for an upcoming drop via the real backend
 * (`POST`/`DELETE /api/drops/{id}/notify`). The backend stores a single
 * reminder lead-time per (org, drop); callers pass one of `REMINDER_CHOICES`,
 * or `null` to clear. On success the feed query is invalidated so the card
 * re-reads the server-sourced `notifyRequested`/`reminderMinutes` (§6.3.1).
 */
export function useDropNotify(dropId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reminderMinutes: number | null) => {
      if (reminderMinutes === null) {
        await apiFetch(`/api/drops/${dropId}/notify`, { method: "DELETE" });
        return;
      }
      await apiFetch(`/api/drops/${dropId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderMinutes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DROP_FEED_KEY });
    },
  });
}
