/**
 * /brand/apply — public brand self-registration (Stage 7 / Phase 1).
 *
 * Submits a brand application (→ pending_review). Gated by the backend
 * `BRAND_SELF_REGISTRATION_ENABLED` flag, surfaced via GET /api/config; when
 * disabled, the page shows an "admin-provisioned only" message instead of the
 * form. After a successful apply, the brand waits for admin approval + an
 * invite email to set their password.
 *
 * The form uses the wide (640px) auth width to pair the applicant and company names.
 */
import { useState } from "react";
import { useBrandApply, usePublicConfig } from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import { userFacingApiError } from "../../api/userFacingError";
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
  Select,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { HowFoundField, howFoundPayload, type HowFoundSource } from "../../components/forms/HowFoundField";
import {
  MARKETING_BUDGET_CODES,
  MARKETING_BUDGET_LABELS,
  type MarketingBudget,
} from "../../utils/marketingBudget";

export default function BrandApplyPage() {
  const config = usePublicConfig();
  const apply = useBrandApply();

  const [contactName, setContactName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [marketingBudget, setMarketingBudget] = useState("");
  const [howFound, setHowFound] = useState<HowFoundSource | "">("");
  const [howFoundOther, setHowFoundOther] = useState("");
  const [intentMessage, setIntentMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Restrictive default: show the form ONLY when self-registration is explicitly
  // enabled. A failed/empty config fetch falls back to "invitation only" rather
  // than rendering a form the backend will 403 (F7).
  const disabled = config.data?.brandSelfRegistrationEnabled !== true;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!howFound) return;
    setError(null);
    setFieldErrors({});
    try {
      await apply.mutateAsync({
        contactName: contactName.trim(),
        brandName: brandName.trim(),
        companyEmail: companyEmail.trim(),
        marketingBudget: marketingBudget as MarketingBudget,
        intentMessage: intentMessage.trim(),
        ...howFoundPayload(howFound, howFoundOther),
      });
      setSubmitted(true);
    } catch (err) {
      const fallback = "Something went wrong. Please try again.";
      const { fields } = userFacingApiError(err, fallback);
      if (fields.howFound || fields.howFoundOther) {
        setFieldErrors(fields);
      } else {
        setError(err instanceof ApiError ? err.message : fallback);
      }
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
    <AuthSplit wide>
      <AuthHeading kicker="Apply as a" title="Brand">
        Tell us about your brand. We&apos;ll email you back with further details,
        or set up a call.
      </AuthHeading>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Your name"
            placeholder="First Last"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            autoComplete="name"
            maxLength={255}
            required
          />

          <TextField
            label="Company name"
            placeholder="Your Brand"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            required
          />
        </div>

        <TextField
          type="email"
          label="Company email"
          value={companyEmail}
          onChange={(e) => setCompanyEmail(e.target.value)}
          placeholder="you@brand.com"
          required
          autoComplete="email"
        />

        <Select
          label="University marketing budget"
          value={marketingBudget}
          onChange={(e) => setMarketingBudget(e.target.value)}
          required
        >
          <option value="" disabled>
            Select a range
          </option>
          {MARKETING_BUDGET_CODES.map((code) => (
            <option key={code} value={code}>
              {MARKETING_BUDGET_LABELS[code]}
            </option>
          ))}
        </Select>

        <HowFoundField
          value={howFound}
          onChange={setHowFound}
          otherValue={howFoundOther}
          onOtherChange={setHowFoundOther}
          disabled={apply.isPending}
          error={fieldErrors.howFound}
          otherError={fieldErrors.howFoundOther}
        />

        <TextArea
          label="What are you hoping to do on BUZZ?"
          value={intentMessage}
          onChange={(e) => setIntentMessage(e.target.value)}
          placeholder="e.g. Sample our new cold brew at fall campus events"
          rows={4}
          maxLength={2000}
          required
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
