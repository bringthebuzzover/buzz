/**
 * Remove `?token=` (and other query) from the address bar after the SPA has
 * captured the one-shot secret into memory, so history/referrer do not keep it.
 */
export function stripTokenFromUrl(): void {
  const { pathname, hash, search } = window.location;
  if (!search) {
    return;
  }
  window.history.replaceState(null, "", pathname + hash);
}
