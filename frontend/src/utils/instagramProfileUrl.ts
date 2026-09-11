/** Public Instagram profile URL for a handle (`@` optional). */
export function instagramProfileUrl(
  handle: string | null | undefined,
): string | null {
  const username = handle?.replace(/^@/, "").trim();
  if (!username) return null;
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}
