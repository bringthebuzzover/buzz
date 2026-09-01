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
export type RotateEduEmailResponse =
  components["schemas"]["RotateEduEmailResponse"];
export type CancelPendingEduEmailResponse =
  components["schemas"]["CancelPendingEduEmailResponse"];
export type BrandApplyResponse = components["schemas"]["BrandApplyResponse"];
export type PublicConfigResponse = components["schemas"]["PublicConfigResponse"];
export type InstagramLookupResponse =
  components["schemas"]["InstagramLookupResponse"];
export type OrgApplyRequest = components["schemas"]["OrgApplyRequest"];
export type AddressSuggestResponse =
  components["schemas"]["AddressSuggestResponse"];
export type AddressPreviewResponse =
  components["schemas"]["AddressPreviewResponse"];
export type AddressSuggestionItem =
  components["schemas"]["AddressSuggestionItem"];

// ── Org onboarding ─────────────────────────────────────────────────────────

export type OrgOnboardingInput = {
  orgName: string;
  university: string;
  eduEmail: string;
  tiktokHandle?: string;
  memberCount: number;
  category: OrgCategory;
  city?: string;
  state?: string;
  contactName: string;
  shippingLine1: string;
  shippingLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPlaceId?: string;
};

export type OrgApplyInput = OrgOnboardingInput & {
  instagramHandle: string;
  handleConfirmed: boolean;
};

/** Public org apply-first signup (→ pending_email_verification, no IG token). */
export function useOrgApply() {
  return useMutation({
    mutationFn: async (input: OrgApplyInput) => {
      const { data } = await apiFetch<OrgOnboardingResponse>("/api/orgs/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return data;
    },
  });
}

/** Exact-username Business Discovery lookup for the apply confirm card. */
export function useInstagramLookup() {
  return useMutation({
    mutationFn: async (username: string) => {
      const q = encodeURIComponent(username.trim().replace(/^@/, ""));
      const { data } = await apiFetch<InstagramLookupResponse>(
        `/api/orgs/instagram-lookup?username=${q}`,
      );
      return data;
    },
  });
}

/** Public US address autocomplete (empty list when Google is unset in development). */
export function useAddressSuggest() {
  return useMutation({
    mutationFn: async (query: string) => {
      const q = encodeURIComponent(query.trim());
      const { data } = await apiFetch<AddressSuggestResponse>(
        `/api/orgs/address-suggest?q=${q}`,
      );
      return data;
    },
  });
}

/** Fill structured fields from a Places suggestion. */
export function useAddressPreview() {
  return useMutation({
    mutationFn: async (placeId: string) => {
      const q = encodeURIComponent(placeId.trim());
      const { data } = await apiFetch<AddressPreviewResponse>(
        `/api/orgs/address-preview?placeId=${q}`,
      );
      return data;
    },
  });
}

/** Public resend of .edu verify mail after apply (no session). */
export function usePublicResendVerification() {
  return useMutation({
    mutationFn: async (eduEmail: string) => {
      const { data } = await apiFetch<ResendVerificationResponse>(
        "/api/auth/verify-email/resend-public",
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

/** Redeem approval connect-email token → session for Connect Instagram. */
export function useRedeemOrgConnect() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await apiFetch<TokenResponse>(
        "/api/auth/org-connect/redeem",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        },
      );
      if (!data.access_token) {
        throw new ApiError(
          "INTERNAL_ERROR",
          "Connect redeem response missing access token.",
          500,
        );
      }
      return data;
    },
  });
}

export type InstagramBindStartResponse = {
  authorizeUrl?: string;
  authorize_url?: string;
};

/** Authenticated bind OAuth start for pending_instagram orgs. */
export function useInstagramBindStart() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiFetch<InstagramBindStartResponse>(
        "/api/auth/instagram/bind-start",
        { method: "POST" },
      );
      const url = data.authorizeUrl ?? data.authorize_url;
      if (!url) {
        throw new ApiError(
          "INTERNAL_ERROR",
          "Bind start response missing authorize URL.",
          500,
        );
      }
      return { authorizeUrl: url };
    },
  });
}

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

export function useRotateEduEmail() {
  return useMutation({
    mutationFn: async (eduEmail: string) => {
      const { data } = await apiFetch<RotateEduEmailResponse>(
        "/api/auth/verify-email/rotate",
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

export function useCancelPendingEduEmail() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiFetch<CancelPendingEduEmailResponse>(
        "/api/auth/verify-email/cancel",
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
