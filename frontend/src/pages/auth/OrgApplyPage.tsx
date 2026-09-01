/**
 * /org/apply — public org apply-first signup (LAUNCH.md Phase A / PRODUCT §6.1).
 *
 * Collects the full org profile plus a claimed Instagram handle confirmed via
 * the same-page Business Discovery lookup card (§6.1.1). On success the org
 * waits for .edu verification with no session yet.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useInstagramLookup,
  useOrgApply,
  type InstagramLookupResponse,
} from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import ShippingAddressFields, {
  EMPTY_SHIPPING,
  shippingToApi,
} from "../../components/org/ShippingAddressFields";
import {
  ORG_CATEGORY_OPTIONS,
  type OrgCategory,
} from "../../types/orgCategory";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

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
  const apply = useOrgApply();
  const lookup = useInstagramLookup();

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
  const [error, setError] = useState<string | null>(null);

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
    if (!category) {
      setError("Select an organization type.");
      return;
    }
    if (!canSubmit) {
      setError("Confirm your organization's Instagram account to continue.");
      return;
    }
    try {
      const result = await apply.mutateAsync({
        orgName: orgName.trim(),
        university: university.trim(),
        eduEmail: eduEmail.trim(),
        instagramHandle: handleNorm,
        handleConfirmed: confirmedMatches,
        tiktokHandle: tiktokHandle.trim().replace(/^@/, "") || undefined,
        memberCount: Number(memberCount),
        category,
        contactName: contactName.trim(),
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
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Apply as a <span className="text-buzz-coral">Student Org</span>
      </h1>
      <p className="mb-4 text-center text-sm font-medium text-buzz-inkMuted">
        Tell us about your organization. We&apos;ll verify your school email,
        review your application, then invite you to connect Instagram.
      </p>
      <p className="mb-8 rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-3 text-xs font-medium text-buzz-inkMuted">
        Your Instagram must be the organization&apos;s{" "}
        <span className="font-semibold text-buzz-ink">Business or Creator</span>{" "}
        account — not a personal member profile. Personal accounts cannot be
        used on Buzz.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Organization name
          </label>
          <input
            data-testid="org-apply-org-name"
            className={inputClass}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            University
          </label>
          <input
            data-testid="org-apply-university"
            className={inputClass}
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            School (.edu) email
          </label>
          <input
            data-testid="org-apply-edu-email"
            type="email"
            className={inputClass}
            value={eduEmail}
            onChange={(e) => setEduEmail(e.target.value)}
            placeholder="you@university.edu"
            required
          />
          <p className="mt-1 text-xs text-buzz-inkMuted">
            We&apos;ll send a verification link here.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Instagram handle
          </label>
          <input
            data-testid="org-apply-instagram"
            className={inputClass}
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="yourorg"
            required
            autoComplete="off"
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
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
              <p className="font-medium">
                Lookup is temporarily unavailable. You can still submit — we&apos;ll
                verify the handle during review.
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-bold text-buzz-coral hover:underline"
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

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            TikTok handle{" "}
            <span className="font-normal text-buzz-inkMuted">(optional)</span>
          </label>
          <input
            className={inputClass}
            value={tiktokHandle}
            onChange={(e) => setTiktokHandle(e.target.value)}
            placeholder="yourorg"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Number of members
          </label>
          <input
            data-testid="org-apply-member-count"
            type="number"
            min="0"
            className={inputClass}
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Organization type
          </label>
          <select
            data-testid="org-apply-category"
            className={inputClass}
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
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Contact name
          </label>
          <input
            data-testid="org-apply-contact-name"
            className={inputClass}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
          />
        </div>

        <ShippingAddressFields
          value={shipping}
          onChange={setShipping}
          inputClass={inputClass}
          testIdPrefix="org-apply"
        />

        <button
          data-testid="org-apply-submit"
          type="submit"
          disabled={!canSubmit}
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
          Already connected Instagram?{" "}
          <Link to="/login" className="font-bold text-buzz-coral hover:underline">
            Org login
          </Link>
        </p>
      </form>
    </div>
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
      <div className="mt-3 rounded-lg border border-buzz-lineMid bg-buzz-paper p-3 text-left">
        <div className="flex gap-3">
          {result.profilePictureUrl ? (
            <img
              src={result.profilePictureUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-buzz-cream text-xs font-bold text-buzz-inkMuted">
              IG
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-buzz-ink">@{handle}</p>
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
          <p className="mt-3 text-sm font-semibold text-green-700">
            Confirmed as your organization&apos;s account.
          </p>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            className="mt-3 w-full rounded-lg bg-buzz-coral px-3 py-2 text-sm font-bold text-buzz-paper transition hover:bg-buzz-coralDark"
          >
            Confirm this is our organization&apos;s account.
          </button>
        )}
      </div>
    );
  }

  if (isSoftFailReason(result.reason)) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
        <p className="font-medium">
          We couldn&apos;t verify that handle right now
          {result.reason === "throttled" ? " (rate limited)" : ""}. You can still
          submit — we&apos;ll confirm it during review.
        </p>
        <button
          type="button"
          className="mt-2 text-xs font-bold text-buzz-coral hover:underline"
          onClick={onRetry}
        >
          Retry lookup
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-800">
      <p className="font-medium">
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
    </div>
  );
}
