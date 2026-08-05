/**
 * TanStack Query mutations for the Stage 7 onboarding + brand-auth surface.
 *
 * Wire format: dict mutation responses (onboarding/verify/resend/brand-apply)
 * are camelCase (camelized at the route layer). The auth token endpoints
 * (`set-password`, `brand/login`) return `TokenResponse`/`UserResponse`, which
 * stay snake_case (`access_token`, `portal_role`) — the established auth
 * contract the SPA already consumes.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../client";
import { setAccessToken } from "../auth";
import type { OrgCategory } from "../../types/orgCategory";

// ── Org onboarding ─────────────────────────────────────────────────────────

export type OrgOnboardingInput = {
  orgName: string;
  university: string;
  eduEmail: string;
  tiktokHandle?: string;
  followerCount?: number;
  memberCount?: number;
  category?: OrgCategory;
  city?: string;
  state?: string;
  contactName?: string;
  deliveryAddress?: string;
};

type OnboardingResult = {
  orgId: string;
  status: string;
  emailSentTo: string;
};

export function useSubmitOnboarding() {
  return useMutation({
    mutationFn: async (input: OrgOnboardingInput) => {
      const { data } = await apiFetch<OnboardingResult>("/api/orgs/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return data;
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await apiFetch<{ status: string }>(
        "/api/auth/verify-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        },
      );
      return data;
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiFetch<{ emailSentTo: string }>(
        "/api/auth/verify-email/resend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      return data;
    },
  });
}

export function useChangeEduEmail() {
  return useMutation({
    mutationFn: async (eduEmail: string) => {
      const { data } = await apiFetch<{ emailSentTo: string; status?: string }>(
        "/api/auth/verify-email/change",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eduEmail }),
        },
      );
      return data;
    },
  });
}

// ── Brand auth ─────────────────────────────────────────────────────────────

type UserPayload = {
  id: string;
  portal_role: string;
  status: string;
  instagram_username: string | null;
  email: string | null;
};

export function useBrandSetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const { data } = await apiFetch<{ access_token: string; user: UserPayload }>(
        "/api/auth/brand/set-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      // Set-password starts a session (same as login) — store the token so the
      // SPA can go straight to the portal without a separate login step.
      setAccessToken(data.access_token);
      return data;
    },
  });
}

export type BrandApplyInput = {
  brandName: string;
  companyEmail: string;
  instagramHandle?: string;
  intentMessage?: string;
};

/** Public brand self-registration (→ pending_review). No auth required. */
export function useBrandApply() {
  return useMutation({
    mutationFn: async (input: BrandApplyInput) => {
      const { data } = await apiFetch<{ brandId: string; status: string }>(
        "/api/brands/apply",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      return data;
    },
  });
}

/** Public feature flags (whether brand self-registration is enabled). */
export function usePublicConfig() {
  return useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const { data } = await apiFetch<{ brandSelfRegistrationEnabled: boolean }>(
        "/api/config",
      );
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useBrandLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await apiFetch<{ access_token: string; user: UserPayload }>(
        "/api/auth/brand/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!data.access_token) {
        throw new ApiError(
          "INTERNAL_ERROR",
          "Login response missing access token.",
          500,
        );
      }
      setAccessToken(data.access_token);
      return data;
    },
  });
}
