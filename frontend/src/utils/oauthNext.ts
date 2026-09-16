/**
 * Client allowlist for OAuth `next`, matching
 * `allowlisted_oauth_next` in `backend/app/security/jwt.py`.
 * Only `/d/<uuid>` is returned; anything else is dropped.
 */
const PUBLIC_DROP_NEXT = /^\/d\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

export function allowlistedOAuthNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = PUBLIC_DROP_NEXT.exec(raw.trim());
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
