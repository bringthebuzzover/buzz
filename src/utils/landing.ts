/**
 * Single source of truth for "where does this user belong right now" — the
 * status-aware landing path. Used by the login page, the OAuth callback target,
 * `RequireStatus`, and the onboarding pages so every redirect agrees instead of
 * stranding users on the public home (`/`).
 */
import type { AuthUser } from "../contexts/AuthContext";

export function pathForUser(user: AuthUser | null): string {
  if (!user) return "/login";

  if (user.portalRole === "org") {
    switch (user.status) {
      case "pending_org_profile":
        return "/onboarding/profile";
      case "pending_email_verification":
        return "/onboarding/verify-email";
      case "pending_approval":
        return "/onboarding/pending-approval";
      case "denied":
      case "suspended":
        return "/onboarding/denied";
      case "active":
        return "/org/browse";
      default:
        return "/";
    }
  }

  if (user.portalRole === "brand") return "/brand/dashboard";
  // Admin has no SPA portal yet; land on home.
  return "/";
}
