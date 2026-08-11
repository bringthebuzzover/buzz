/**
 * Allowlist http(s) URLs for href / img src. Rejects javascript:, data: (as
 * navigation), and other non-http schemes that would enable XSS via
 * attacker-controlled permalinks.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (url == null || url === "") {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}
