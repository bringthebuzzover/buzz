/**
 * /onboarding/profile — org profile setup (Stage 7, Phase 2).
 *
 * Shown when user.status === "pending_org_profile". On submit it creates the
 * org profile, advances the account to pending_email_verification, and triggers
 * the .edu verification email; we then refresh the user so the route guard
 * forwards to /onboarding/verify-email.
 *
 * Followers are Graph-seeded server-side — not collected here.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSubmitOnboarding } from "../../api/hooks/useOnboardingHooks";
import { userFacingApiError } from "../../api/userFacingError";
import { pathForUser } from "../../utils/landing";
import FieldError from "../../components/forms/FieldError";
import {
  Button,
  ErrorBanner,
  Select,
  TextField,
  fieldClass,
} from "../../components/forms/controls";
import AuthShell from "../../components/site/AuthShell";
import ShippingAddressFields, {
  EMPTY_SHIPPING,
  shippingToApi,
} from "../../components/org/ShippingAddressFields";
import {
  ORG_CATEGORY_OPTIONS,
  type OrgCategory,
} from "../../types/orgCategory";
import {
  isFieldError,
  parseEduEmail,
  parseMemberCount,
  requireNonBlank,
  unwrapParsed,
} from "../../utils/formValidation";

export default function OrgProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const submit = useSubmitOnboarding();

  const [orgName, setOrgName] = useState("");
  const [university, setUniversity] = useState("");
  const [eduEmail, setEduEmail] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [contactName, setContactName] = useState("");
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!user || user.status !== "pending_org_profile") {
    return <Navigate to={pathForUser(user)} replace />;
  }

  const signedInAs = user.instagramUsername
    ? `@${user.instagramUsername.replace(/^@/, "")}`
    : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!category) {
      setError("Select an organization type.");
      return;
    }
    const next: Record<string, string> = {};
    const name = requireNonBlank(orgName);
    if (isFieldError(name)) next.orgName = name.error;
    const uni = requireNonBlank(university);
    if (isFieldError(uni)) next.university = uni.error;
    const edu = parseEduEmail(eduEmail);
    if (isFieldError(edu)) next.eduEmail = edu.error;
    const members = parseMemberCount(memberCount);
    if (isFieldError(members)) next.memberCount = members.error;
    const contact = requireNonBlank(contactName);
    if (isFieldError(contact)) next.contactName = contact.error;
    const line1 = requireNonBlank(shipping.line1);
    const city = requireNonBlank(shipping.city);
    const state = requireNonBlank(shipping.state);
    const zip = requireNonBlank(shipping.postalCode);
    if (
      isFieldError(line1) ||
      isFieldError(city) ||
      isFieldError(state) ||
      isFieldError(zip)
    ) {
      next.shipping = "Must not be empty";
    }
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    try {
      const result = await submit.mutateAsync({
        orgName: unwrapParsed(name),
        university: unwrapParsed(uni),
        eduEmail: unwrapParsed(edu),
        memberCount: unwrapParsed(members),
        category,
        contactName: unwrapParsed(contact),
        ...shippingToApi(shipping),
      });
      await refreshUser();
      // Durable across hard refresh of the verify-await screen.
      sessionStorage.setItem(
        "buzz.verifyEmailSent",
        result.emailSent === false ? "0" : "1",
      );
      navigate("/onboarding/verify-email", {
        replace: true,
        state: { emailSent: result.emailSent !== false },
      });
    } catch (err) {
      const mapped = userFacingApiError(
        err,
        "Something went wrong. Please try again.",
      );
      setFieldErrors(mapped.fields);
      setError(mapped.banner);
    }
  };

  return (
    <AuthShell align="stack">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Set Up Your <span className="text-buzz-coral">Org Profile</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Tell us about your organization to continue. Sign in with the
        organization&apos;s Instagram Business or Creator account — not a
        personal member account.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {signedInAs && (
          <div className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-buzz-inkMuted">
              Signed in as
            </p>
            <p className="mt-1 text-sm font-semibold text-buzz-ink">{signedInAs}</p>
            <p className="mt-1 text-xs text-buzz-inkMuted">
              This Instagram account is your org identity on Buzz.
            </p>
          </div>
        )}

        <div>
          <TextField
            label="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.orgName)}
            aria-describedby={fieldErrors.orgName ? "org-onboarding-org-name-error" : undefined}
          />
          <FieldError id="org-onboarding-org-name-error" message={fieldErrors.orgName} />
        </div>

        <div>
          <TextField
            label="University"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.university)}
            aria-describedby={
              fieldErrors.university ? "org-onboarding-university-error" : undefined
            }
          />
          <FieldError
            id="org-onboarding-university-error"
            message={fieldErrors.university}
          />
        </div>

        <div>
          <TextField
            type="email"
            label="School (.edu) email"
            value={eduEmail}
            onChange={(e) => setEduEmail(e.target.value)}
            placeholder="you@university.edu"
            required
            aria-invalid={Boolean(fieldErrors.eduEmail)}
            aria-describedby={
              fieldErrors.eduEmail ? "org-onboarding-edu-email-error" : undefined
            }
          />
          <FieldError
            id="org-onboarding-edu-email-error"
            message={fieldErrors.eduEmail}
          />
          <p className="mt-1 text-xs text-buzz-inkMuted">
            We&apos;ll send a verification link here.
          </p>
        </div>

        <div>
          <TextField
            type="number"
            min="0"
            label="Number of members"
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.memberCount)}
            aria-describedby={
              fieldErrors.memberCount ? "org-onboarding-member-count-error" : undefined
            }
          />
          <FieldError
            id="org-onboarding-member-count-error"
            message={fieldErrors.memberCount}
          />
        </div>

        <Select
          label="Organization type"
          value={category}
          onChange={(e) => setCategory(e.target.value as OrgCategory | "")}
          required
        >
          <option value="">Select a type…</option>
          {ORG_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div>
          <TextField
            label="Contact name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.contactName)}
            aria-describedby={
              fieldErrors.contactName ? "org-onboarding-contact-name-error" : undefined
            }
          />
          <FieldError
            id="org-onboarding-contact-name-error"
            message={fieldErrors.contactName}
          />
        </div>

        <ShippingAddressFields
          value={shipping}
          onChange={setShipping}
          inputClass={fieldClass.default}
          testIdPrefix="org-onboarding"
          error={fieldErrors.shipping}
        />

        <Button
          type="submit"
          disabled={submit.isPending}
          className="w-full"
        >
          {submit.isPending ? "Submitting…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
