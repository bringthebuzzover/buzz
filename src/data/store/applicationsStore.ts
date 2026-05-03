/**
 * Applications entity store — backed by `buzz.v1.applications`.
 */
import type {
  ApplicationDecision,
  DropApplication,
} from "../../types/orgCampaign";
import { readJSON, storeEvents, storeKey, writeJSON } from "./mockStore";

const KEY = storeKey("applications");

let cache: DropApplication[] | null = null;

function load(): DropApplication[] {
  if (cache != null) return cache;
  cache = readJSON<DropApplication[]>(KEY, []);
  return cache;
}

function persist(next: DropApplication[]): void {
  cache = next;
  writeJSON(KEY, next);
}

export const applicationsStore = {
  getAll(): DropApplication[] {
    return load();
  },

  getById(id: string): DropApplication | undefined {
    return load().find((a) => a.id === id);
  },

  listForOrg(orgId: string): DropApplication[] {
    return load().filter((a) => a.orgId === orgId);
  },

  listForDrop(dropId: string): DropApplication[] {
    return load().filter((a) => a.dropId === dropId);
  },

  /** Number of accepted (or active) applications, used to derive drop fill counts. */
  countAcceptedForDrop(dropId: string): number {
    return load().filter(
      (a) => a.dropId === dropId && a.decision === "accepted"
    ).length;
  },

  /** Insert a brand-new application. Caller generates the id. */
  insert(application: DropApplication): void {
    persist([...load(), application]);
  },

  update(id: string, patch: Partial<DropApplication>): void {
    const next = load().map((a) => (a.id === id ? { ...a, ...patch } : a));
    persist(next);
  },

  setDecision(
    id: string,
    decision: ApplicationDecision,
    trackingNumber?: string
  ): void {
    const next = load().map((a) =>
      a.id === id
        ? {
            ...a,
            decision,
            decisionAt: Date.now(),
            trackingNumber: trackingNumber ?? a.trackingNumber,
          }
        : a
    );
    persist(next);
  },

  replaceAll(rows: DropApplication[]): void {
    persist(rows);
  },

  invalidate(): void {
    cache = null;
    storeEvents.emit();
  },

  subscribe: storeEvents.subscribe,
};
