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
import { Link } from "react-router-dom";
import {
  useBrandApply,
  usePublicConfig,
} from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">Loading...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-8 py-24 text-center">
        <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
          Application <span className="text-buzz-coral">Received</span>
        </h1>
        <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
          Thanks! Our team will review your brand. Once approved, you'll get an
          email with a link to set your password and sign in.
        </p>
        <Link
          to="/"
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper transition hover:bg-buzz-coralDark"
        >
          Back home
        </Link>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="mx-auto max-w-md px-8 py-24 text-center">
        <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
          Brand <span className="text-buzz-coral">Sign-Up</span>
        </h1>
        <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
          Brand accounts are currently set up by invitation only. Reach out to
          the Buzz team to get started.
        </p>
        <Link to="/brand/login" className="font-bold text-buzz-coral hover:underline">
          Already have an account? Brand login
        </Link>
        <p className="mt-4 text-sm font-medium text-buzz-inkMuted">
          <Link to="/for-brands" className="font-bold text-buzz-coral hover:underline">
            See how it works
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Apply as a <span className="text-buzz-coral">Brand</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Tell us about your brand. We'll review and email you a setup link once
        approved.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Brand name
          </label>
          <input
            className={inputClass}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Company email
          </label>
          <input
            type="email"
            className={inputClass}
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            placeholder="you@brand.com"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Instagram handle{" "}
            <span className="font-normal text-buzz-inkMuted">(optional)</span>
          </label>
          <input
            className={inputClass}
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="yourbrand"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            What are you hoping to do on Buzz?{" "}
            <span className="font-normal text-buzz-inkMuted">(optional)</span>
          </label>
          <textarea
            className={inputClass}
            rows={3}
            value={intentMessage}
            onChange={(e) => setIntentMessage(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={apply.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {apply.isPending ? "Submitting…" : "Submit application"}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-buzz-inkMuted">
          <Link to="/for-brands" className="font-bold text-buzz-coral hover:underline">
            See how it works
          </Link>
        </p>
        <p className="text-center text-xs text-buzz-inkMuted">
          Already have an account?{" "}
          <Link to="/brand/login" className="font-bold text-buzz-coral hover:underline">
            Brand login
          </Link>
        </p>
      </form>
    </div>
  );
}
