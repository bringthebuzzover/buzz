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

/** A bounded draft identifier, never an arbitrary URL or OAuth credential. */
export function allowlistedPrefill(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(raw) ? raw : null;
}

export function onboardingQuery(next?: string | null, prefill?: string | null): string {
  const params = new URLSearchParams();
  const allowed = allowlistedOAuthNext(next);
  const draft = allowlistedPrefill(prefill);
  if (allowed) params.set("next", allowed);
  if (draft) params.set("prefill", draft);
  const query = params.toString();
  return query ? `?${query}` : "";
}
