/**
 * React surface over the localStorage entity stores. Exposes hooks that subscribe
 * via `useSyncExternalStore` so any write — including from the demo clock —
 * triggers a re-render in subscribed components without manual prop drilling.
 *
 * Also exposes mutation helpers (`applyToDrop`, `linkPostToCampaign`, ...) so UI
 * components don't import the underlying stores directly.
 */
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Drop } from "../types/drop";
import type {
  ApplicationDecision,
  DropApplication,
} from "../types/orgCampaign";
import type { PostCampaignLink, SocialPost } from "../types/socialPost";
import type { BrandDropTrackerStage } from "../types/brandPortal";

import { applicationsStore } from "../data/store/applicationsStore";
import { dropsStore } from "../data/store/dropsStore";
import { linksStore } from "../data/store/linksStore";
import { postsStore } from "../data/store/postsStore";
import {
  brandTrackerStore,
  type BrandTrackerEvent,
} from "../data/store/brandTrackerStore";
import { ensureSeeded, resetAndReseed } from "../data/store/seedAll";
import { canAssignPostToCampaign } from "../utils/postAttribution";

type MockDataValue = {
  resetDemo: () => void;

  /** Mutations — UI components call these instead of touching stores directly. */
  insertDrop: (drop: Drop) => void;
  setDropTrackerStage: (
    dropId: string,
    stage: BrandDropTrackerStage,
    trackingNumber?: string
  ) => void;
  insertApplication: (application: DropApplication) => void;
  setApplicationDecision: (
    applicationId: string,
    decision: ApplicationDecision,
    trackingNumber?: string
  ) => void;
  /** Returns false when the post is already linked to a different campaign. */
  linkPostToCampaign: (input: {
    postId: string;
    applicationId: string;
    dropId: string;
  }) => boolean;
  unlinkPost: (postId: string) => void;
  recordTrackerEvent: (event: BrandTrackerEvent) => void;
  upsertPostMetrics: (post: SocialPost) => void;
  /**
   * Brand Applicant Selection: accept chosen orgs with unit counts, deny other
   * pending applicants on the drop, and mark the drop's selection as finalized.
   */
  finalizeBrandApplicantSelection: (
    dropId: string,
    allocations: { applicationId: string; units: number }[]
  ) => void;
};

const MockDataContext = createContext<MockDataValue | null>(null);

/**
 * One-time seed. Importing the seed runner at module scope keeps the React tree
 * pure (provider has no side effects on mount beyond the value memo).
 */
ensureSeeded();

export function MockDataProvider({ children }: { children: ReactNode }) {
  const value = useMemo<MockDataValue>(
    () => ({
      resetDemo: () => {
        resetAndReseed();
      },
      insertDrop: (drop) => dropsStore.insert(drop),
      setDropTrackerStage: (dropId, stage, trackingNumber) =>
        dropsStore.setBrandTrackerStage(dropId, stage, trackingNumber),
      insertApplication: (application) =>
        applicationsStore.insert(application),
      setApplicationDecision: (id, decision, trackingNumber) =>
        applicationsStore.setDecision(id, decision, trackingNumber),
      linkPostToCampaign: ({ postId, applicationId, dropId }) => {
        const result = canAssignPostToCampaign(
          postId,
          applicationId,
          linksStore.getAll()
        );
        if (!result.allowed) return false;
        return linksStore.link({
          postId,
          applicationId,
          dropId,
          linkedAt: Date.now(),
        });
      },
      unlinkPost: (postId) => linksStore.unlinkPost(postId),
      recordTrackerEvent: (event) => brandTrackerStore.insert(event),
      upsertPostMetrics: (post) => postsStore.update(post.id, post),
      finalizeBrandApplicantSelection: (dropId, allocations) => {
        const drop = dropsStore.getById(dropId);
        if (!drop) return;
        const cap =
          drop.totalProductUnits ?? Math.max(1, drop.capacityTotal) * 50;
        const positive = allocations.filter((row) => row.units > 0);
        if (positive.length === 0) return;
        const sum = positive.reduce((s, row) => s + row.units, 0);
        if (sum > cap) return;
        const applied = applicationsStore
          .listForDrop(dropId)
          .filter((a) => a.decision === "applied");
        const chosen = new Set(positive.map((a) => a.applicationId));
        const ts = Date.now();
        for (const app of applied) {
          if (chosen.has(app.id)) {
            const units = positive.find((r) => r.applicationId === app.id)!.units;
            applicationsStore.update(app.id, {
              decision: "accepted",
              decisionAt: ts,
              allocatedUnits: units,
            });
          } else {
            applicationsStore.update(app.id, {
              decision: "denied",
              decisionAt: ts,
            });
          }
        }
        dropsStore.update(dropId, { applicantSelectionFinalizedAt: ts });
      },
    }),
    []
  );

  return (
    <MockDataContext.Provider value={value}>
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockData(): MockDataValue {
  const ctx = useContext(MockDataContext);
  if (!ctx) {
    throw new Error("useMockData must be used within MockDataProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Read hooks — `useSyncExternalStore` over each entity store. The snapshot getter
// returns the same array reference between writes, so React will not re-render
// when nothing has changed.
// ---------------------------------------------------------------------------

export function useDrops(): Drop[] {
  return useSyncExternalStore(dropsStore.subscribe, dropsStore.getAll);
}

export function useDrop(dropId: string | undefined): Drop | undefined {
  const drops = useDrops();
  return useMemo(
    () => (dropId ? drops.find((d) => d.id === dropId) : undefined),
    [drops, dropId]
  );
}

export function useBrandDrops(brandId: string): Drop[] {
  const drops = useDrops();
  return useMemo(
    () => drops.filter((d) => d.brandId === brandId),
    [drops, brandId]
  );
}

export function useApplications(): DropApplication[] {
  return useSyncExternalStore(
    applicationsStore.subscribe,
    applicationsStore.getAll
  );
}

export function useApplicationsForOrg(orgId: string): DropApplication[] {
  const apps = useApplications();
  return useMemo(() => apps.filter((a) => a.orgId === orgId), [apps, orgId]);
}

export function useApplicationsForDrop(dropId: string): DropApplication[] {
  const apps = useApplications();
  return useMemo(
    () => apps.filter((a) => a.dropId === dropId),
    [apps, dropId]
  );
}

/** Number of accepted applications per drop, derived from the applications snapshot. */
export function useDropFillCount(dropId: string): number {
  const apps = useApplicationsForDrop(dropId);
  return useMemo(
    () => apps.filter((a) => a.decision === "accepted").length,
    [apps]
  );
}

export function usePosts(): SocialPost[] {
  return useSyncExternalStore(postsStore.subscribe, postsStore.getAll);
}

export function usePostsForOrg(orgId: string): SocialPost[] {
  const posts = usePosts();
  return useMemo(() => posts.filter((p) => p.orgId === orgId), [posts, orgId]);
}

export function useLinks(): PostCampaignLink[] {
  return useSyncExternalStore(linksStore.subscribe, linksStore.getAll);
}

export function useLinksForApplication(
  applicationId: string
): PostCampaignLink[] {
  const links = useLinks();
  return useMemo(
    () => links.filter((l) => l.applicationId === applicationId),
    [links, applicationId]
  );
}

export function useLinksForDrop(dropId: string): PostCampaignLink[] {
  const links = useLinks();
  return useMemo(() => links.filter((l) => l.dropId === dropId), [links, dropId]);
}

export function useTrackerEventsForDrop(dropId: string): BrandTrackerEvent[] {
  const events = useSyncExternalStore(
    brandTrackerStore.subscribe,
    brandTrackerStore.getAll
  );
  return useMemo(
    () =>
      events
        .filter((e) => e.dropId === dropId)
        .sort((a, b) => a.occurredAt - b.occurredAt),
    [events, dropId]
  );
}

/** Convenience alias used by Phase 4 components — renamed for readability. */
export const useLinksForCampaign = useLinksForApplication;
