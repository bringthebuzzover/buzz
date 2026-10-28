/**
 * META-REVIEWER-PATH: only the Instagram authorize URL may be followed.
 * Delete this file with the rest of `src/meta-reviewer/`.
 */
export function isInstagramAuthorizeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "www.instagram.com" || url.hostname === "instagram.com") &&
      url.pathname === "/oauth/authorize"
    );
  } catch {
    return false;
  }
}
