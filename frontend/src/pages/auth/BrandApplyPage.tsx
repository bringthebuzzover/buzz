/**
 * /brand/apply — public brand self-registration (Stage 7 / Phase 1).
 *
 * Submits a brand application (→ pending_review). Gated by the backend
 * `BRAND_SELF_REGISTRATION_ENABLED` flag, surfaced via GET /api/config; when
 * disabled, the page shows an "admin-provisioned only" message instead of the
 * form. After a successful apply, the brand waits for admin approval + an
 * invite email to set their password.
 */
import { useState } from "react";
import { useBrandApply, usePublicConfig } from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import {
  AuthArrowLink,
  AuthHeading,
  AuthLinkRow,
  AuthSplit,
} from "../../components/auth/AuthFrame";
import AuthPending from "../../components/auth/AuthPending";
import {
  Button,
  ErrorBanner,
  LinkButton,
  TextField,
} from "../../components/forms/controls";

export default function BrandApplyPage() {
  const config = usePublicConfig();
  const apply = useBrandApply();

  const [brandName, setBrandName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [intentMessage, setIntentMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Restrictive default: show the form ONLY when self-registration is explicitly
  // enabled. A failed/empty config fetch falls back to "invitation only" rather
  // than rendering a form the backend will 403 (F7).
  const disabled = config.data?.brandSelfRegistrationEnabled !== true;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apply.mutateAsync({
        brandName: brandName.trim(),
        companyEmail: companyEmail.trim(),
        instagramHandle: instagramHandle.trim().replace(/^@/, "") || undefined,
        intentMessage: intentMessage.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  if (config.isLoading) {
    return <AuthPending />;
  }

  if (submitted) {
    return (
      <AuthSplit>
        <AuthHeading kicker="Brand" title="Application Received">
          Thanks! Our team will review your brand. Once approved, you&apos;ll get
          an email with a link to set your password and sign in.
        </AuthHeading>
        <LinkButton to="/" size="field">
          Back home
        </LinkButton>
      </AuthSplit>
    );
  }

  if (disabled) {
    return (
      <AuthSplit>
        <AuthHeading kicker="Brand" title="Sign-Up">
          Brand accounts are currently set up by invitation only. Reach out to
          the Buzz team to get started.
        </AuthHeading>
        <div className="space-y-3">
          <AuthLinkRow quiet="Already have an account?">
            <AuthArrowLink to="/brand/login">Brand login</AuthArrowLink>
          </AuthLinkRow>
          <p>
            <AuthArrowLink to="/for-brands">See how it works</AuthArrowLink>
          </p>
        </div>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <AuthHeading kicker="Apply as a" title="Brand">
        Tell us about your brand. We&apos;ll review and email you a setup link
        once approved.
      </AuthHeading>

      <form onSubmit={onSubmit} className="space-y-6">
        <TextField
          label="Brand name"
          placeholder="e.g. Sample Brand"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          required
        />

        <TextField
          type="email"
          label="Company email"
          value={companyEmail}
          onChange={(e) => setCompanyEmail(e.target.value)}
          placeholder="you@brand.com"
          required
          autoComplete="email"
        />

        <TextField
          label={
            <>
              Instagram handle{" "}
              <span className="font-normal text-quiet">(optional)</span>
            </>
          }
          value={instagramHandle}
          onChange={(e) => setInstagramHandle(e.target.value)}
          placeholder="yourbrand"
        />

        <TextField
          label={
            <>
              What are you hoping to do on BUZZ?{" "}
              <span className="font-normal text-quiet">(optional)</span>
            </>
          }
          value={intentMessage}
          onChange={(e) => setIntentMessage(e.target.value)}
          placeholder="e.g. Sample our new cold brew at fall campus events"
        />

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Button
          type="submit"
          size="field"
          loading={apply.isPending}
          loadingLabel="Submitting…"
          fullWidth
        >
          Submit application
        </Button>

        <div className="space-y-3">
          <p>
            <AuthArrowLink to="/for-brands">See how it works</AuthArrowLink>
          </p>
          <AuthLinkRow quiet="Already have an account?">
            <AuthArrowLink to="/brand/login">Brand login</AuthArrowLink>
          </AuthLinkRow>
        </div>
      </form>
    </AuthSplit>
  );
}
