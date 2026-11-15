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
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOrgApplyPrefill, useSubmitOnboarding } from "../../api/hooks/useOnboardingHooks";
import { userFacingApiError } from "../../api/userFacingError";
import { allowlistedOAuthNext, allowlistedPrefill, onboardingQuery } from "../../utils/oauthNext";
import { clearDropPitch, readDropPitch } from "../../utils/dropSignup";
import { pathForUser } from "../../utils/landing";
import {
  Button,
  ErrorBanner,
  Notice,
  Select,
  TextField,
  fieldClass,
} from "../../components/forms/controls";
import AuthPending from "../../components/auth/AuthPending";
import { AuthHeading, AuthSplit } from "../../components/auth/AuthFrame";
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
  const [params] = useSearchParams();
  const nextPath = allowlistedOAuthNext(params.get("next"));
  const prefillToken = allowlistedPrefill(params.get("prefill"));
  const draft = useOrgApplyPrefill(user?.status === "pending_org_profile" ? prefillToken : null);
  const hydrated = useRef<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [university, setUniversity] = useState("");
  const [eduEmail, setEduEmail] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [contactName, setContactName] = useState("");
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!draft.data || hydrated.current === prefillToken) return;
    hydrated.current = prefillToken;
    const d = draft.data;
    setOrgName(d.orgName ?? "");
    setUniversity(d.university ?? "");
    setEduEmail(d.eduEmail ?? "");
    setMemberCount(d.memberCount == null ? "" : String(d.memberCount));
    setCategory((d.category as OrgCategory) ?? "");
    setContactName(d.contactName ?? "");
    setShipping({ line1: d.shippingLine1 ?? "", line2: d.shippingLine2 ?? "",
      city: d.shippingCity ?? "", state: d.shippingState ?? "",
      postalCode: d.shippingPostalCode ?? "", placeId: "" });
  }, [draft.data, prefillToken]);

  if (!user || user.status !== "pending_org_profile") {
    return <Navigate to={pathForUser(user, nextPath)} replace />;
  }

  if (prefillToken && draft.isPending) return <AuthPending />;

  const signedInAs = user.instagramUsername
    ? `@${user.instagramUsername.replace(/^@/, "")}`
    : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prefillToken && (draft.isPending || draft.isError)) return;
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
        prefillToken: prefillToken ?? undefined,
        dropId: nextPath?.slice(3),
        pitch: nextPath ? readDropPitch(nextPath).trim() || undefined : undefined,
        orgName: unwrapParsed(name),
        university: unwrapParsed(uni),
        eduEmail: unwrapParsed(edu),
        memberCount: unwrapParsed(members),
        category,
        contactName: unwrapParsed(contact),
        ...shippingToApi(shipping),
      });
      clearDropPitch();
      await refreshUser();
      // Durable across hard refresh of the verify-await screen.
      sessionStorage.setItem(
        "buzz.verifyEmailSent",
        result.emailQueued === false ? "0" : "1",
      );
      navigate("/onboarding/verify-email" + onboardingQuery(nextPath), {
        replace: true,
        state: { emailQueued: result.emailQueued !== false },
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
    <AuthSplit
      wide
      asideStatement="Join as a student organization and work with brands on real campus campaigns."
    >
      <AuthHeading kicker="Step 2 of 3 · Connected" title="Campus Profile">
        Instagram connected. Tell us about your campus community and where to
        ship campaign drop kits.
      </AuthHeading>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {draft.isError && <ErrorBanner>{userFacingApiError(draft.error, "Could not load this application draft. Please reopen your invitation link.").banner}</ErrorBanner>}
        {draft.data?.shippingRaw && <p className="text-xs text-quiet">You wrote: {draft.data.shippingRaw}</p>}
        <Notice
          tone="success"
          icon={<Check className="h-4 w-4" aria-hidden />}
        >
          {`Connected as ${signedInAs ?? "@org"} · Professional Account`}
        </Notice>

        <TextField
          id="org-onboarding-contact-name"
          label="Contact name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Test Officer"
          required
          error={fieldErrors.contactName}
        />

        <div>
          <TextField
            id="org-onboarding-edu-email"
            type="email"
            label="School (.edu) email"
            value={eduEmail}
            onChange={(e) => setEduEmail(e.target.value)}
            placeholder="org1@example.edu"
            required
            error={fieldErrors.eduEmail}
          />
          <p className="mt-1 text-xs text-quiet">
            Must be a university .edu address for campus verification.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="org-onboarding-org-name"
            label="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Test Student Organization"
            required
            error={fieldErrors.orgName}
          />

          <TextField
            id="org-onboarding-university"
            label="University"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="Test University"
            required
            error={fieldErrors.university}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <TextField
            id="org-onboarding-member-count"
            type="number"
            min="0"
            label="Active members"
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            placeholder="120"
            required
            error={fieldErrors.memberCount}
          />
        </div>

        <ShippingAddressFields
          value={shipping}
          onChange={setShipping}
          inputClass={fieldClass.default}
          testIdPrefix="org-onboarding"
          error={fieldErrors.shipping}
          layout="split"
        />

        <Button
          type="submit"
          disabled={submit.isPending || Boolean(prefillToken && (draft.isPending || draft.isError))}
          size="field"
          fullWidth
        >
          {submit.isPending ? "Submitting…" : "Complete Application"}
        </Button>

        <div className="flex items-center gap-2 pt-2 text-sm text-quiet">
          <span>Already connected Instagram?</span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 font-medium text-primary hover:text-accent"
          >
            Organization login &rarr;
          </Link>
        </div>
      </form>
    </AuthSplit>
  );
}
