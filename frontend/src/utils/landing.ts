/**
 * Single source of truth for "where does this user belong right now" — the
 * status-aware landing path. Used by the login page, the OAuth callback target,
 * `RequireStatus`, and the onboarding pages so every redirect agrees instead of
 * stranding users on the public home (`/`).
 */
import type { AuthUser } from "../contexts/AuthContext";

import { allowlistedOAuthNext, onboardingQuery } from "./oauthNext";

export function pathForUser(user: AuthUser | null, next?: string | null, prefill?: string | null): string {
  const query = onboardingQuery(next);
  const activeNext = user?.status === "active" ? allowlistedOAuthNext(next) : null;
  if (activeNext) return activeNext;
  if (!user) return "/login" + onboardingQuery(next, prefill);

  if (user.portalRole === "org") {
    switch (user.status) {
      case "pending_org_profile":
        return "/onboarding/profile" + onboardingQuery(next, prefill);
      case "pending_email_verification":
        return "/onboarding/verify-email" + query;
      case "pending_approval":
        return "/onboarding/pending-approval" + query;
      case "pending_instagram":
        return "/onboarding/connect-instagram" + query;
      case "denied":
        return "/onboarding/denied";
      case "erased":
        return "/login";
      case "active":
        return "/org/browse";
      default:
        // Unknown/unexpected status — send to login rather than the public home
        // so the user re-authenticates and re-derives their state.
        return "/login";
    }
  }

  if (user.portalRole === "brand") return "/brand/dashboard";
  // Admin lands on the panel overview.
  return "/admin";
}
