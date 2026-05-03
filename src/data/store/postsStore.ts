/**
 * Social posts entity store — backed by `buzz.v1.posts`.
 */
import type { PostMetricsSnapshot, SocialPost } from "../../types/socialPost";
import { readJSON, storeEvents, storeKey, writeJSON } from "./mockStore";

const KEY = storeKey("posts");

let cache: SocialPost[] | null = null;

function load(): SocialPost[] {
  if (cache != null) return cache;
  cache = readJSON<SocialPost[]>(KEY, []);
  return cache;
}

function persist(next: SocialPost[]): void {
  cache = next;
  writeJSON(KEY, next);
}

export const postsStore = {
  getAll(): SocialPost[] {
    return load();
  },

  getById(id: string): SocialPost | undefined {
    return load().find((p) => p.id === id);
  },

  listForOrg(orgId: string): SocialPost[] {
    return load().filter((p) => p.orgId === orgId);
  },

  /** Replace metrics on a post (used by the demo clock's periodic refresh). */
  setMetrics(id: string, metrics: PostMetricsSnapshot): void {
    const next = load().map((p) => (p.id === id ? { ...p, metrics } : p));
    persist(next);
  },

  insert(post: SocialPost): void {
    persist([...load(), post]);
  },

  update(id: string, patch: Partial<SocialPost>): void {
    const next = load().map((p) => (p.id === id ? { ...p, ...patch } : p));
    persist(next);
  },

  replaceAll(rows: SocialPost[]): void {
    persist(rows);
  },

  invalidate(): void {
    cache = null;
    storeEvents.emit();
  },

  subscribe: storeEvents.subscribe,
};
