/**
 * Creator portal hooks. Query hooks return `{ data, isLoading, isError }` and
 * mutation hooks return `{ mutate, isPending }` so swapping the in-memory
 * store for TanStack Query against the creator API keeps page code unchanged.
 */
import { useMemo, useSyncExternalStore } from "react";
import {
  actions,
  buzzFeeFor,
  getState,
  subscribe,
  type MockDrop,
  type MockState,
} from "./mockCreatorStore";
import type {
  CreatorApplication,
  CreatorApplyInput,
  CreatorCampaign,
  CreatorDrop,
  CreatorEarnings,
  CreatorPayoutRow,
  CreatorPost,
  CreatorProfile,
  CreatorRosterRow,
  CreatorStatus,
} from "./types";

type Query<T> = { data: T; isLoading: false; isError: false };
type Mutation<A extends unknown[]> = { mutate: (...args: A) => void; isPending: false };

const query = <T>(data: T): Query<T> => ({ data, isLoading: false, isError: false });
const mutation = <A extends unknown[]>(fn: (...args: A) => void): Mutation<A> => ({
  mutate: fn,
  isPending: false,
});

function useMockState(): MockState {
  return useSyncExternalStore(subscribe, getState, getState);
}

function toDrop(drop: MockDrop, applications: CreatorApplication[]): CreatorDrop {
  const acceptedCount = applications.filter(
    (row) => row.dropId === drop.id && row.decision === "accepted",
  ).length;
  const buzzFee = buzzFeeFor(drop.creatorGross);
  return {
    id: drop.id,
    title: drop.title,
    brandName: drop.brandName,
    description: drop.description,
    imageUrl: drop.imageUrl,
    status: drop.upcoming
      ? "upcoming"
      : drop.windowOpen && acceptedCount < drop.creatorCap
        ? "open"
        : "closed",
    windowOpen: drop.windowOpen,
    creatorCap: drop.creatorCap,
    acceptedCount,
    creatorGross: drop.creatorGross,
    buzzFee,
    brandTotal: drop.creatorGross + buzzFee,
  };
}

function findPost(state: MockState, application: CreatorApplication): CreatorPost | null {
  if (!application.linkedPostId) return null;
  return (
    (state.posts[application.creatorId] ?? []).find(
      (row) => row.id === application.linkedPostId,
    ) ?? null
  );
}

function viewerOf(state: MockState): CreatorProfile | null {
  return state.creators.find((row) => row.id === state.viewerId) ?? null;
}

/** Profile completeness as a whole percent, from fields a creator controls. */
export function creatorCompleteness(profile: CreatorProfile): number {
  const checks = [
    profile.name,
    profile.school,
    profile.city,
    profile.gradYear,
    profile.bio,
    profile.niches.length > 0,
    profile.openTo.length > 0,
    profile.instagramConnected,
    profile.tiktokHandle,
    profile.portfolio.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function useCreatorSession(): Query<{ status: CreatorStatus | null }> {
  const state = useMockState();
  const status = viewerOf(state)?.status ?? null;
  return useMemo(() => query({ status }), [status]);
}

export function useCreatorProfile(): Query<CreatorProfile | null> {
  const state = useMockState();
  return useMemo(() => query(viewerOf(state)), [state]);
}

export function useCreatorPosts(): Query<CreatorPost[]> {
  const state = useMockState();
  return useMemo(
    () => query(state.viewerId ? (state.posts[state.viewerId] ?? []) : []),
    [state],
  );
}

export function useCreatorDrops(): Query<CreatorDrop[]> {
  const state = useMockState();
  return useMemo(
    () => query(state.drops.map((drop) => toDrop(drop, state.applications))),
    [state],
  );
}

export function useCreatorDrop(dropId: string): Query<CreatorDrop | null> {
  const state = useMockState();
  return useMemo(() => {
    const drop = state.drops.find((row) => row.id === dropId);
    return query(drop ? toDrop(drop, state.applications) : null);
  }, [state, dropId]);
}

export function useCreatorCampaigns(): Query<CreatorCampaign[]> {
  const state = useMockState();
  return useMemo(() => {
    const rows: CreatorCampaign[] = [];
    for (const application of state.applications) {
      if (application.creatorId !== state.viewerId) continue;
      const drop = state.drops.find((row) => row.id === application.dropId);
      if (!drop) continue;
      rows.push({
        application,
        drop: toDrop(drop, state.applications),
        linkedPost: findPost(state, application),
      });
    }
    return query(rows);
  }, [state]);
}

/** Paid is what Buzz recorded; pending is accepted work not yet recorded. */
export function useCreatorEarnings(): Query<CreatorEarnings> {
  const { data: campaigns } = useCreatorCampaigns();
  return useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (const { application, drop } of campaigns) {
      if (application.decision !== "accepted") continue;
      if (application.payout === "recorded") paid += drop.creatorGross;
      else pending += drop.creatorGross;
    }
    return query({ paid, pending, yearToDate: paid + pending });
  }, [campaigns]);
}

export function useCreatorRoster(dropId: string): Query<CreatorRosterRow[]> {
  const state = useMockState();
  return useMemo(() => {
    const rows: CreatorRosterRow[] = [];
    for (const application of state.applications) {
      if (application.dropId !== dropId) continue;
      const creator = state.creators.find((row) => row.id === application.creatorId);
      if (!creator) continue;
      rows.push({ application, creator, linkedPost: findPost(state, application) });
    }
    return query(rows);
  }, [state, dropId]);
}

export function useCreatorReviewQueue(): Query<CreatorProfile[]> {
  const state = useMockState();
  return useMemo(
    () => query(state.creators.filter((row) => row.status === "pending_review")),
    [state],
  );
}

export function useCreatorPayoutQueue(): Query<CreatorPayoutRow[]> {
  const state = useMockState();
  return useMemo(() => {
    const rows: CreatorPayoutRow[] = [];
    for (const application of state.applications) {
      if (application.content !== "accepted" || application.payout === "recorded") continue;
      const creator = state.creators.find((row) => row.id === application.creatorId);
      const drop = state.drops.find((row) => row.id === application.dropId);
      if (!creator || !drop) continue;
      rows.push({ application, creator, drop: toDrop(drop, state.applications) });
    }
    return query(rows);
  }, [state]);
}

export const useApplyAsCreator = () =>
  mutation((input: CreatorApplyInput) => actions.apply(input));
export const useConfirmCreatorEmail = () => mutation(() => actions.confirmEmail());
export const useConnectCreatorInstagram = () => mutation(() => actions.connectInstagram());
export const useAddPortfolioItem = () =>
  mutation((title: string, link: string) => actions.addPortfolioItem(title, link));
export const useApplyToCreatorDrop = () =>
  mutation((dropId: string, pitch: string) => actions.applyToDrop(dropId, pitch));
export const useLinkCreatorPost = () =>
  mutation((applicationId: string, postId: string) => actions.linkPost(applicationId, postId));
export const useCreatorSignOut = () => mutation(() => actions.signOut());

export const useCloseCreatorApplyWindow = () =>
  mutation((dropId: string) => actions.closeApplyWindow(dropId));
export const useFinalizeCreatorRoster = () =>
  mutation((dropId: string, acceptedIds: string[]) => actions.finalize(dropId, acceptedIds));
export const useAcceptCreatorPost = () =>
  mutation((applicationId: string) => actions.acceptPost(applicationId));
export const useReviewCreator = () =>
  mutation((creatorId: string, approve: boolean) => actions.reviewCreator(creatorId, approve));
export const useRecordCreatorPayout = () =>
  mutation((applicationId: string) => actions.recordPayout(applicationId));
