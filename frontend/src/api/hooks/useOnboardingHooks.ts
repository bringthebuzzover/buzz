/**
 * TanStack Query mutations for the Stage 7 onboarding + brand-auth surface.
 *
 * Auth token endpoints (`set-password`, `brand/login`) return snake_case
 * `TokenResponse` / `UserResponse` (`access_token`, `portal_role`) — do not
 * CamelModel those on the backend.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../client";
import type { components } from "../generated/schema";
import type { OrgCategory } from "../../types/orgCategory";

export type TokenResponse = components["schemas"]["TokenResponse"];
export type OrgOnboardingResponse = components["schemas"]["OrgOnboardingResponse"];
export type VerifyEmailResponse = components["schemas"]["VerifyEmailResponse"];
export type ResendVerificationResponse =
  components["schemas"]["ResendVerificationResponse"];
export type ChangeEduEmailResponse =
  components["schemas"]["ChangeEduEmailResponse"];
export type BrandApplyResponse = components["schemas"]["BrandApplyResponse"];
export type PublicConfigResponse = components["schemas"]["PublicConfigResponse"];

// ── Org onboarding ─────────────────────────────────────────────────────────

export type OrgOnboardingInput = {
  orgName: string;
  university: string;
  eduEmail: string;
  tiktokHandle?: string;
  memberCount: number;
  category: OrgCategory;
  city: string;
  state: string;
  contactName: string;
  deliveryAddress: string;
};

export function useSubmitOnboarding() {
  return useMutation({
    mutationFn: async (input: OrgOnboardingInput) => {
      const { data } = await apiFetch<OrgOnboardingResponse>(
        "/api/orgs/onboarding",
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

export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await apiFetch<VerifyEmailResponse>(
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
      const { data } = await apiFetch<ResendVerificationResponse>(
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
      const { data } = await apiFetch<ChangeEduEmailResponse>(
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

export function useBrandSetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const { data } = await apiFetch<TokenResponse>(
        "/api/auth/brand/set-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      // Set-password starts a session (same as login). Caller installs the
      // token via acceptSession so bootstrap cannot race a bare setAccessToken.
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
      const { data } = await apiFetch<BrandApplyResponse>("/api/brands/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return data;
    },
  });
}

/** Public feature flags (whether brand self-registration is enabled). */
export function usePublicConfig() {
  return useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const { data } = await apiFetch<PublicConfigResponse>("/api/config");
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useBrandLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await apiFetch<TokenResponse>("/api/auth/brand/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!data.access_token) {
        throw new ApiError(
          "INTERNAL_ERROR",
          "Login response missing access token.",
          500,
        );
      }
      // Token installed in acceptSession (atomic with gen bump + authenticated).
      return data;
    },
  });
}
