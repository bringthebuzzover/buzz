/**
 * TanStack Query hook for the org drop browse feed (`GET /api/drops`).
 *
 * The wire shape is camelCase + epoch-ms, matching `DropFeedRow` exactly, so no
 * remapping is needed. The query is enabled only once the auth bootstrap has a
 * session (otherwise the request would 401).
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { useAuth } from "../../contexts/AuthContext";
import type { DropFeedRow } from "../../types/drop";

export function useOrgDropFeed() {
  const { status } = useAuth();
  const query = useQuery({
    queryKey: ["org-drop-feed"],
    queryFn: async () => {
      const { data } = await apiFetch<DropFeedRow[]>("/api/drops");
      return data;
    },
    enabled: status === "authenticated",
  });

  // A disabled query reports `isPending` forever, so derive loading/error from
  // the auth bootstrap too: an auth failure must surface as an error (not an
  // infinite spinner), and `query.isLoading` is false while the query is gated.
  const authError = status === "error" ? new Error("Authentication failed.") : null;

  return {
    items: query.data ?? [],
    isLoading: status === "authenticating" || query.isLoading,
    error: authError ?? query.error,
  };
}
