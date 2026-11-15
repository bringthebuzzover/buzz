/**
 * Remove `?token=` (and other query) from the address bar after the SPA has
 * captured the one-shot secret into memory, so history/referrer do not keep it.
 */
import { onboardingQuery } from "./oauthNext";

export function stripTokenFromUrl(next?: string | null): void {
  const { pathname, hash, search } = window.location;
  if (!search) {
    return;
  }
  window.history.replaceState(null, "", pathname + onboardingQuery(next) + hash);
}
