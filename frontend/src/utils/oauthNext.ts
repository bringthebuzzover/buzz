/**
 * Client allowlist for OAuth `next`, matching
 * `allowlisted_oauth_next` in `backend/app/security/jwt.py`.
 * `/d/<uuid>` and `/creators/feed` are returned; anything else is dropped.
 */
const PUBLIC_DROP_NEXT = /^\/d\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const CREATOR_FEED_NEXT = "/creators/feed";

export function allowlistedOAuthNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === CREATOR_FEED_NEXT) return CREATOR_FEED_NEXT;
  const match = PUBLIC_DROP_NEXT.exec(trimmed);
  if (!match) return null;
  return `/d/${match[1].toLowerCase()}`;
}

export function publicDropPath(dropId: string): string {
  return `/d/${dropId}`;
}

export function publicDropAbsUrl(dropId: string): string {
  if (typeof window === "undefined") return publicDropPath(dropId);
  return `${window.location.origin}${publicDropPath(dropId)}`;
}
