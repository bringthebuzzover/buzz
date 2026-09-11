/**
 * /org/apply — public org apply-first signup (LAUNCH.md Phase A / PRODUCT §6.1).
 *
 * Collects the full org profile plus a claimed Instagram handle confirmed via
 * the same-page Business Discovery lookup card (§6.1.1). On success the org
 * waits for .edu verification with no session yet.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useInstagramLookup,
  useOrgApply,
  useOrgApplyPrefill,
  type InstagramLookupResponse,
} from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import { userFacingApiError } from "../../api/userFacingError";
import FieldError from "../../components/forms/FieldError";
import {
  Button,
  ErrorBanner,
  Select,
  SuccessBanner,
  TextField,
  WarningBanner,
  fieldClass,
} from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
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

const LOOKUP_DEBOUNCE_MS = 500;
const META_PROFESSIONAL_HELP =
  "https://help.instagram.com/502981923235522";

const VERIFY_EMAIL_SENT_KEY = "buzz.verifyEmailSent";
const VERIFY_EDU_EMAIL_KEY = "buzz.verifyEduEmail";

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

function isSoftFailReason(reason: string | null | undefined): boolean {
  return reason === "unavailable" || reason === "throttled";
}

function isBlockReason(reason: string | null | undefined): boolean {
  return reason === "not_found" || reason === "not_professional";
}

export default function OrgApplyPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prefillToken] = useState(() => searchParams.get("prefill"));
  const apply = useOrgApply();
  const lookup = useInstagramLookup();
  const prefill = useOrgApplyPrefill(prefillToken);
  const hydrated = useRef(false);

  const [orgName, setOrgName] = useState("");
  const [university, setUniversity] = useState("");
  const [eduEmail, setEduEmail] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [handleConfirmed, setHandleConfirmed] = useState(false);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<InstagramLookupResponse | null>(
    null,
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [contactName, setContactName] = useState("");
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const [shippingRawHint, setShippingRawHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [prefillError, setPrefillError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefillToken) return;
    setSearchParams({}, { replace: true });
  }, [prefillToken, setSearchParams]);

  useEffect(() => {
    if (prefill.isError && prefillToken) {
      setPrefillError(
        "This apply link is invalid or expired. You can still fill out the form.",
      );
    }
  }, [prefill.isError, prefillToken]);

  useEffect(() => {
    if (!prefill.data || hydrated.current) return;
    hydrated.current = true;
    const d = prefill.data;
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
  }, [prefill.data]);

  const lookupGen = useRef(0);
  const handleNorm = normalizeHandle(instagramHandle);
  const confirmedMatches =
    handleConfirmed && confirmedFor !== null && confirmedFor === handleNorm;

  useEffect(() => {
    setHandleConfirmed(false);
    setConfirmedFor(null);
    setLookupResult(null);
    setLookupError(null);

    if (!handleNorm || handleNorm.length < 1) return;

    const gen = ++lookupGen.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await lookup.mutateAsync(handleNorm);
          if (gen !== lookupGen.current) return;
          setLookupResult(data);
          setLookupError(null);
        } catch (err) {
          if (gen !== lookupGen.current) return;
          setLookupResult(null);
          setLookupError(
            err instanceof ApiError
              ? err.message
              : "Could not look up that Instagram handle. Try again.",
          );
        }
      })();
    }, LOOKUP_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
    // lookup.mutateAsync is stable enough; omit the whole mutation object.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on handle only
  }, [handleNorm]);

  const softFail =
    Boolean(lookupResult && isSoftFailReason(lookupResult.reason)) ||
    Boolean(lookupError);
  const blocked =
    Boolean(lookupResult && isBlockReason(lookupResult.reason)) ||
    (lookupResult !== null &&
      !lookupResult.available &&
      !isSoftFailReason(lookupResult.reason));

  const canSubmit =
    Boolean(handleNorm) &&
    !blocked &&
    (confirmedMatches || softFail) &&
    !apply.isPending;

  const onConfirmHandle = () => {
    if (!lookupResult?.available || !lookupResult.username) return;
    const confirmed = normalizeHandle(lookupResult.username);
    setHandleConfirmed(true);
    setConfirmedFor(confirmed);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!category) {
      setError("Select an organization type.");
      return;
    }
    if (!canSubmit) {
      setError("Confirm your organization's Instagram account to continue.");
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
      const result = await apply.mutateAsync({
        orgName: unwrapParsed(name),
        university: unwrapParsed(uni),
        eduEmail: unwrapParsed(edu),
        instagramHandle: handleNorm,
        handleConfirmed: confirmedMatches,
        prefillToken: prefillToken || undefined,
        tiktokHandle: tiktokHandle.trim().replace(/^@/, "") || undefined,
        memberCount: unwrapParsed(members),
        category,
        contactName: unwrapParsed(contact),
        ...shippingToApi(shipping),
      });
      sessionStorage.setItem(
        VERIFY_EMAIL_SENT_KEY,
        result.emailSent === false ? "0" : "1",
      );
      sessionStorage.setItem(VERIFY_EDU_EMAIL_KEY, eduEmail.trim().toLowerCase());
      navigate("/onboarding/verify-email", {
        replace: true,
        state: {
          emailSent: result.emailSent !== false,
          eduEmail: eduEmail.trim().toLowerCase(),
        },
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
    <PageShell width="form">
      <h1 className={cn(TEXT.h1, "mb-2 text-center text-buzz-ink")}>
        Apply as a <span className="text-buzz-coral">Student Org</span>
      </h1>
      <p className="mb-4 text-center text-sm font-medium text-buzz-inkMuted">
        Tell us about your organization. We&apos;ll verify your school email,
        review your application, then invite you to connect Instagram.
      </p>
      {prefillError && (
        <div className="mb-4" data-testid="org-apply-prefill-error">
          <WarningBanner>{prefillError}</WarningBanner>
        </div>
      )}
      <p className={cn(SURFACE.inset, "mb-8 px-3 py-3 text-xs font-medium text-buzz-inkMuted")}>
        Your Instagram must be the organization&apos;s{" "}
        <span className="font-semibold text-buzz-ink">Business or Creator</span>{" "}
        account — not a personal member profile. Personal accounts cannot be
        used on Buzz.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div>
          <TextField
            data-testid="org-apply-org-name"
            label="Organization name"
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

        <div>
          <TextField
            data-testid="org-apply-edu-email"
            type="email"
            label="School (.edu) email"
            value={eduEmail}
            onChange={(e) => setEduEmail(e.target.value)}
            placeholder="you@university.edu"
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
          <p className="mt-1 text-xs text-buzz-inkMuted">
            We&apos;ll send a verification link here.
          </p>
        </div>

        <div>
          <TextField
            data-testid="org-apply-instagram"
            label="Instagram handle"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="yourorg"
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
          <p className="mt-1 text-xs text-buzz-inkMuted">
            Exact username of the org Business/Creator account (with or without
            @).
          </p>

          {lookup.isPending && handleNorm && (
            <p className="mt-2 text-xs font-medium text-buzz-inkMuted">
              Looking up @{handleNorm}…
            </p>
          )}

          {lookupError && (
            <div className="mt-3 text-left">
              <WarningBanner>
                <p>
                  Lookup is temporarily unavailable. You can still submit — we&apos;ll
                  verify the handle during review.
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-buzz-coral hover:underline"
                  onClick={() => {
                    setLookupError(null);
                    lookupGen.current += 1;
                    void lookup.mutateAsync(handleNorm).then(
                      (data) => {
                        setLookupResult(data);
                        setLookupError(null);
                      },
                      (err: unknown) => {
                        setLookupError(
                          err instanceof ApiError
                            ? err.message
                            : "Could not look up that Instagram handle.",
                        );
                      },
                    );
                  }}
                >
                  Retry lookup
                </button>
              </WarningBanner>
            </div>
          )}

          {lookupResult && !lookupError && (
            <InstagramConfirmCard
              result={lookupResult}
              confirmed={confirmedMatches}
              onConfirm={onConfirmHandle}
              onRetry={() => {
                setLookupResult(null);
                setLookupError(null);
                lookupGen.current += 1;
                void lookup.mutateAsync(handleNorm).then(
                  (data) => setLookupResult(data),
                  (err: unknown) => {
                    setLookupError(
                      err instanceof ApiError
                        ? err.message
                        : "Could not look up that Instagram handle.",
                    );
                  },
                );
              }}
            />
          )}
        </div>

        <TextField
          label={
            <>
              TikTok handle{" "}
              <span className="font-normal text-buzz-inkMuted">(optional)</span>
            </>
          }
          value={tiktokHandle}
          onChange={(e) => setTiktokHandle(e.target.value)}
          placeholder="yourorg"
        />

        <div>
          <TextField
            data-testid="org-apply-member-count"
            type="number"
            min="0"
            label="Number of members"
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
          <option value="">Select a type…</option>
          {ORG_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div>
          <TextField
            data-testid="org-apply-contact-name"
            label="Contact name"
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
        />
        {shippingRawHint && (
          <p
            data-testid="org-apply-shipping-raw"
            className="text-xs font-medium text-buzz-inkMuted"
          >
            You wrote: {shippingRawHint}
          </p>
        )}

        <Button
          data-testid="org-apply-submit"
          type="submit"
          disabled={!canSubmit}
          fullWidth
        >
          {apply.isPending ? "Submitting…" : "Submit application"}
        </Button>

        <p className="text-center text-xs text-buzz-inkMuted">
          Already connected Instagram?{" "}
          <Link to="/login" className="font-semibold text-buzz-coral hover:underline">
            Org login
          </Link>
        </p>
      </form>
    </PageShell>
  );
}

function InstagramConfirmCard({
  result,
  confirmed,
  onConfirm,
  onRetry,
}: {
  result: InstagramLookupResponse;
  confirmed: boolean;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  if (result.available && result.username) {
    const handle = normalizeHandle(result.username);
    return (
      <div className={cn(SURFACE.inset, "mt-3 p-3 text-left")}>
        <div className="flex gap-3">
          {result.profilePictureUrl ? (
            <img
              src={result.profilePictureUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-buzz-cream text-xs font-semibold text-buzz-inkMuted">
              IG
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-buzz-ink">@{handle}</p>
            {result.name && (
              <p className="truncate text-sm font-medium text-buzz-inkMuted">
                {result.name}
              </p>
            )}
            {typeof result.followersCount === "number" && (
              <p className="text-xs text-buzz-inkMuted">
                {result.followersCount.toLocaleString()} followers
              </p>
            )}
          </div>
        </div>
        {result.biography && (
          <p className="mt-2 line-clamp-3 text-xs text-buzz-inkMuted">
            {result.biography}
          </p>
        )}
        {confirmed ? (
          <div className="mt-3">
            <SuccessBanner>
              Confirmed as your organization&apos;s account.
            </SuccessBanner>
          </div>
        ) : (
          <Button
            type="button"
            onClick={onConfirm}
            fullWidth
            className="mt-3"
          >
            Confirm this is our organization&apos;s account.
          </Button>
        )}
      </div>
    );
  }

  if (isSoftFailReason(result.reason)) {
    return (
      <div className="mt-3 text-left">
        <WarningBanner>
          <p>
            We couldn&apos;t verify that handle right now
            {result.reason === "throttled" ? " (rate limited)" : ""}. You can still
            submit — we&apos;ll confirm it during review.
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-buzz-coral hover:underline"
            onClick={onRetry}
          >
            Retry lookup
          </button>
        </WarningBanner>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <ErrorBanner>
        <p>
          {result.reason === "not_professional"
            ? "That Instagram account is not a Business or Creator (professional) profile."
            : "We couldn't find that Instagram username."}{" "}
          Buzz needs your organization&apos;s professional account — not a personal
          member profile.
        </p>
        <a
          href={META_PROFESSIONAL_HELP}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-bold text-buzz-coral hover:underline"
        >
          How to switch to a professional account
        </a>
      </ErrorBanner>
    </div>
  );
}
