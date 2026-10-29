/**
 * Shared org apply-first fields (PRODUCT §6.1 / §6.1.1). Used by `/org/apply`
 * and the public drop page. Do not nest `OrgApplyPage`.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useOrgApply,
  type OrgApplyInput,
} from "../../api/hooks/useOnboardingHooks";
import { userFacingApiError } from "../../api/userFacingError";
import FieldError from "../forms/FieldError";
import { AuthArrowLink, AuthLinkRow } from "../auth/AuthFrame";
import {
  Button,
  ErrorBanner,
  Select,
  TextArea,
  TextField,
  fieldClass,
} from "../forms/controls";
import ShippingAddressFields, {
  EMPTY_SHIPPING,
  shippingToApi,
  type ShippingAddressValue,
} from "./ShippingAddressFields";
import {
  ORG_CATEGORY_OPTIONS,
  type OrgCategory,
} from "../../types/orgCategory";
import { cn } from "../../theme/cn";
import {
  isFieldError,
  parseEduEmail,
  parseMemberCount,
  requireNonBlank,
  unwrapParsed,
} from "../../utils/formValidation";

export const VERIFY_EMAIL_SENT_KEY = "buzz.verifyEmailSent";
export const VERIFY_EDU_EMAIL_KEY = "buzz.verifyEduEmail";
export const VERIFY_DROP_INTENT_KEY = "buzz.verifyDropIntent";

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

export type OrgApplyPrefillValues = {
  orgName?: string | null;
  university?: string | null;
  eduEmail?: string | null;
  instagramHandle?: string | null;
  memberCount?: number | null;
  category?: string | null;
  contactName?: string | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingRaw?: string | null;
};

export default function OrgApplyForm({
  dropId,
  prefillToken,
  prefill,
  submitLabel,
  loginHref = "/login",
  paired = false,
  className,
  onSuccess,
}: {
  dropId?: string;
  prefillToken?: string | null;
  prefill?: OrgApplyPrefillValues | null;
  submitLabel: string;
  loginHref?: string;
  /** Public drop card pairs the pen's three rows at every width. */
  paired?: boolean;
  className?: string;
  onSuccess: (result: { emailSent?: boolean }, eduEmail: string) => void;
}) {
  const apply = useOrgApply();
  const hydrated = useRef(false);

  const [orgName, setOrgName] = useState("");
  const [university, setUniversity] = useState("");
  const [eduEmail, setEduEmail] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [contactName, setContactName] = useState("");
  const [shipping, setShipping] = useState<ShippingAddressValue>(EMPTY_SHIPPING);
  const [shippingRawHint, setShippingRawHint] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!prefill || hydrated.current) return;
    hydrated.current = true;
    const d = prefill;
    if (d.orgName) setOrgName(d.orgName);
    if (d.university) setUniversity(d.university);
    if (d.eduEmail) setEduEmail(d.eduEmail);
    if (d.instagramHandle) setInstagramHandle(d.instagramHandle);
    if (d.memberCount != null) setMemberCount(String(d.memberCount));
    if (d.category) setCategory(d.category as OrgCategory);
    if (d.contactName) setContactName(d.contactName);
    setShipping({
      line1: d.shippingLine1 ?? "",
      line2: d.shippingLine2 ?? "",
      city: d.shippingCity ?? "",
      state: d.shippingState ?? "",
      postalCode: d.shippingPostalCode ?? "",
      placeId: "",
    });
    if (d.shippingRaw) setShippingRawHint(d.shippingRaw);
  }, [prefill]);

  const handleNorm = normalizeHandle(instagramHandle);

  const canSubmit = Boolean(handleNorm) && !apply.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!category) {
      setError("Select an organization type.");
      return;
    }
    if (!canSubmit) {
      setError("Enter your organization's Instagram handle to continue.");
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
      const body: OrgApplyInput = {
        orgName: unwrapParsed(name),
        university: unwrapParsed(uni),
        eduEmail: unwrapParsed(edu),
        instagramHandle: handleNorm,
        prefillToken: prefillToken || undefined,
        tiktokHandle: tiktokHandle.trim().replace(/^@/, "") || undefined,
        memberCount: unwrapParsed(members),
        category,
        contactName: unwrapParsed(contact),
        ...shippingToApi(shipping),
      };
      if (dropId) {
        body.dropId = dropId;
        const trimmed = pitch.trim();
        if (trimmed) body.pitch = trimmed;
      }
      const result = await apply.mutateAsync(body);
      onSuccess(result, eduEmail.trim().toLowerCase());
    } catch (err) {
      const mapped = userFacingApiError(
        err,
        "Something went wrong. Please try again.",
      );
      setFieldErrors(mapped.fields);
      setError(mapped.banner);
    }
  };

  const pairClass = paired
    ? "grid grid-cols-2 gap-4 [&>*]:min-w-0"
    : "grid grid-cols-1 gap-4 sm:grid-cols-2";

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={cn("space-y-6", className)}>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className={pairClass}>
        <div>
          <TextField
            data-testid="org-apply-org-name"
            label="Organization name"
            placeholder="e.g. Sample Club"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.orgName)}
            aria-describedby={fieldErrors.orgName ? "org-apply-org-name-error" : undefined}
          />
          <FieldError id="org-apply-org-name-error" message={fieldErrors.orgName} />
        </div>

        <div>
          <TextField
            data-testid="org-apply-university"
            label="University"
            placeholder="e.g. Sample University"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.university)}
            aria-describedby={
              fieldErrors.university ? "org-apply-university-error" : undefined
            }
          />
          <FieldError
            id="org-apply-university-error"
            message={fieldErrors.university}
          />
        </div>
      </div>

      <div>
        <TextField
          data-testid="org-apply-edu-email"
          type="email"
          label="School (.edu) email"
          value={eduEmail}
          onChange={(e) => setEduEmail(e.target.value)}
          placeholder="e.g. you@university.edu"
          hint="We'll send a verification link here."
          required
          aria-invalid={Boolean(fieldErrors.eduEmail)}
          aria-describedby={
            fieldErrors.eduEmail ? "org-apply-edu-email-error" : undefined
          }
        />
        <FieldError
          id="org-apply-edu-email-error"
          message={fieldErrors.eduEmail}
        />
      </div>

      <div className={pairClass}>
        <div>
          <TextField
            data-testid="org-apply-instagram"
            label="Instagram handle"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="e.g. @yourorg"
            required
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.instagramHandle)}
            aria-describedby={
              fieldErrors.instagramHandle
                ? "org-apply-instagram-error"
                : undefined
            }
          />
          <FieldError
            id="org-apply-instagram-error"
            message={fieldErrors.instagramHandle}
          />
        </div>

        <TextField
          label={
            <>
              TikTok handle{" "}
              <span className="font-normal text-quiet">(optional)</span>
            </>
          }
          value={tiktokHandle}
          onChange={(e) => setTiktokHandle(e.target.value)}
          placeholder="e.g. @yourorg"
        />
      </div>
      <p className="text-xs text-quiet">
        Exact username of the organization Business/Creator account (with or
        without @). BUZZ checks the username shape here; the account is
        confirmed when you Connect Instagram after approval.
      </p>

      <div className={pairClass}>
        <div>
          <TextField
            data-testid="org-apply-member-count"
            type="number"
            min="0"
            label="Number of members"
            placeholder="e.g. 85"
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.memberCount)}
            aria-describedby={
              fieldErrors.memberCount ? "org-apply-member-count-error" : undefined
            }
          />
          <FieldError
            id="org-apply-member-count-error"
            message={fieldErrors.memberCount}
          />
        </div>

        <Select
          data-testid="org-apply-category"
          label="Organization type"
          value={category}
          onChange={(e) => setCategory(e.target.value as OrgCategory | "")}
          required
        >
          <option value="">Select a type</option>
          {ORG_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <TextField
          data-testid="org-apply-contact-name"
          label="Contact name"
          placeholder="e.g. Sam Sample"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.contactName)}
          aria-describedby={
            fieldErrors.contactName ? "org-apply-contact-name-error" : undefined
          }
        />
        <FieldError
          id="org-apply-contact-name-error"
          message={fieldErrors.contactName}
        />
      </div>

      <ShippingAddressFields
        value={shipping}
        onChange={setShipping}
        inputClass={fieldClass.default}
        testIdPrefix="org-apply"
        error={fieldErrors.shipping}
        layout="split"
      />
      {shippingRawHint && (
        <p
          data-testid="org-apply-shipping-raw"
          className="text-xs font-medium text-quiet"
        >
          You wrote: {shippingRawHint}
        </p>
      )}

      {dropId ? (
        <TextArea
          data-testid="public-drop-pitch"
          label={
            <>
              Pitch{" "}
              <span className="font-normal text-quiet">(optional)</span>
            </>
          }
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
          placeholder="Optional pitch message..."
        />
      ) : null}

      <Button
        data-testid="org-apply-submit"
        type="submit"
        size="field"
        disabled={!handleNorm}
        loading={apply.isPending}
        loadingLabel="Submitting…"
        fullWidth
        className="disabled:border-transparent disabled:bg-buzz-paper08 disabled:text-muted"
      >
        {submitLabel}
      </Button>
      {!handleNorm ? (
        <p className="text-center text-xs text-quiet">
          Enter an Instagram handle to submit.
        </p>
      ) : null}

      <AuthLinkRow quiet="Already connected Instagram?">
        <AuthArrowLink to={loginHref}>Organization login</AuthArrowLink>
      </AuthLinkRow>
    </form>
  );
}

export function persistVerifyEmailHandoff(
  result: { emailSent?: boolean },
  eduEmail: string,
  extraState?: Record<string, unknown>,
) {
  sessionStorage.setItem(
    VERIFY_EMAIL_SENT_KEY,
    result.emailSent === false ? "0" : "1",
  );
  sessionStorage.setItem(VERIFY_EDU_EMAIL_KEY, eduEmail);
  if (extraState?.dropIntent) {
    sessionStorage.setItem(VERIFY_DROP_INTENT_KEY, "1");
  }
}

export function goToVerifyEmailWait(
  navigate: ReturnType<typeof useNavigate>,
  result: { emailSent?: boolean },
  eduEmail: string,
  extraState?: Record<string, unknown>,
) {
  persistVerifyEmailHandoff(result, eduEmail, extraState);
  navigate("/onboarding/verify-email", {
    replace: true,
    state: {
      emailSent: result.emailSent !== false,
      eduEmail,
      ...extraState,
    },
  });
}
