/**
 * Post-to-campaign link store — backed by `buzz.v1.links`. Enforces uniqueness on
 * `postId` at the application layer (one post can belong to at most one campaign).
 */
import type { PostCampaignLink } from "../../types/socialPost";
import { readJSON, storeEvents, storeKey, writeJSON } from "./mockStore";

const KEY = storeKey("links");

let cache: PostCampaignLink[] | null = null;

function load(): PostCampaignLink[] {
  if (cache != null) return cache;
  cache = readJSON<PostCampaignLink[]>(KEY, []);
  return cache;
}

function persist(next: PostCampaignLink[]): void {
  cache = next;
  writeJSON(KEY, next);
}

export const linksStore = {
  getAll(): PostCampaignLink[] {
    return load();
  },

  /** All links for a given application (i.e. an org's participation in a drop). */
  listForApplication(applicationId: string): PostCampaignLink[] {
    return load().filter((l) => l.applicationId === applicationId);
  },

  /** All links for a given drop, rolled up across orgs. */
  listForDrop(dropId: string): PostCampaignLink[] {
    return load().filter((l) => l.dropId === dropId);
  },

  /** The single existing link for a post, or undefined. */
  findByPost(postId: string): PostCampaignLink | undefined {
    return load().find((l) => l.postId === postId);
  },

  /**
   * Add a link if `postId` is not already linked elsewhere.
   * Returns `true` on insert, `false` if the post is already attributed.
   */
  link(link: PostCampaignLink): boolean {
    const existing = load().find((l) => l.postId === link.postId);
    if (existing) return false;
    persist([...load(), link]);
    return true;
  },

  /** Remove a post's link entirely. */
  unlinkPost(postId: string): void {
    const next = load().filter((l) => l.postId !== postId);
    persist(next);
  },

  replaceAll(rows: PostCampaignLink[]): void {
    persist(rows);
  },

  invalidate(): void {
    cache = null;
    storeEvents.emit();
  },

  subscribe: storeEvents.subscribe,
};
