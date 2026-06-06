/**
 * TanStack Query mutations for the Stage 7 onboarding + brand-auth surface.
 *
 * Note: the org-onboarding and brand-auth endpoints return plain (snake_case)
 * payloads — `UserResponse` / `TokenResponse` and small dicts — not the
 * camelCase brand/org models. The hooks here read snake_case fields directly.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { setAccessToken } from "../auth";

// ── Org onboarding ─────────────────────────────────────────────────────────

export type OrgOnboardingInput = {
  orgName: string;
  university: string;
  eduEmail: string;
  instagramHandle: string;
  tiktokHandle?: string;
  followerCount?: number;
  memberCount?: number;
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
      // Store the access token in memory so subsequent requests are authed.
      setAccessToken(data.access_token);
      return data;
    },
  });
}
