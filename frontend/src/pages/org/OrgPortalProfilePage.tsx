/**
 * `/org/profile` — view/edit org profile after onboarding (PRODUCT.md §3.1).
 *
 * Distinct from `/onboarding/profile`, which creates the org row. Instagram
 * handle is login identity (read-only); .edu rotates via pending-swap APIs
 * (not PATCH). Follower count is Graph-owned (read-only). Other fields PATCH
 * via `/api/orgs/me`.
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { userFacingApiError } from "../../api/userFacingError";
import FieldError from "../../components/forms/FieldError";
import {
  useOrgProfile,
  useUpdateOrgProfile,
  type OrgProfileUpdate,
} from "../../api/hooks/useOrgHooks";
import EduEmailRotatePanel from "../../components/org/EduEmailRotatePanel";
import ShippingAddressFields, {
  EMPTY_SHIPPING,
  shippingToApi,
  type ShippingAddressValue,
} from "../../components/org/ShippingAddressFields";
import {
  ORG_CATEGORY_OPTIONS,
  type OrgCategory,
} from "../../types/orgCategory";
import {
  isFieldError,
  parseMemberCount,
  requireNonBlank,
  unwrapParsed,
} from "../../utils/formValidation";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

export default function OrgPortalProfilePage() {
  const { data, isLoading, error: loadError } = useOrgProfile();
  const update = useUpdateOrgProfile();
  const queryClient = useQueryClient();

  const [orgName, setOrgName] = useState("");
  const [university, setUniversity] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [contactName, setContactName] = useState("");
  const [shipping, setShipping] = useState<ShippingAddressValue>(EMPTY_SHIPPING);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setOrgName(data.orgName);
    setUniversity(data.university);
    setTiktokHandle(data.tiktokHandle ?? "");
    setMemberCount(data.memberCount != null ? String(data.memberCount) : "");
    setCategory((data.category as OrgCategory | null) ?? "");
    setContactName(data.contactName ?? "");
    setShipping({
      line1: data.shippingLine1 ?? "",
      line2: data.shippingLine2 ?? "",
      city: data.shippingCity ?? "",
      state: data.shippingState ?? "",
      postalCode: data.shippingPostalCode ?? "",
      placeId: "",
    });
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setError(null);
    setFieldErrors({});
    setSaved(false);

    if (!category) {
      setError("Select an organization type.");
      return;
    }
    const next: Record<string, string> = {};
    const name = requireNonBlank(orgName);
    if (isFieldError(name)) next.orgName = name.error;
    const uni = requireNonBlank(university);
    if (isFieldError(uni)) next.university = uni.error;
    const members = parseMemberCount(memberCount);
    if (isFieldError(members)) next.memberCount = members.error;
    const contact = requireNonBlank(contactName);
    if (isFieldError(contact)) next.contactName = contact.error;
    const ship = shippingToApi(shipping);
    const hasStructured = Boolean(data.shippingLine1);
    const shippingMissing =
      !ship.shippingLine1 ||
      !ship.shippingCity ||
      !ship.shippingState ||
      !ship.shippingPostalCode;
    if (!hasStructured && shippingMissing) {
      next.shipping = "Enter a US mailing address (street, city, state, and ZIP).";
    } else if (hasStructured && shippingMissing) {
      next.shipping = "Shipping street, city, state, and ZIP are required.";
    }
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

    const parsedName = unwrapParsed(name);
    const parsedUni = unwrapParsed(uni);
    const parsedMembers = unwrapParsed(members);
    const parsedContact = unwrapParsed(contact);

    const payload: OrgProfileUpdate = {};
    if (parsedName !== data.orgName) payload.orgName = parsedName;
    if (parsedUni !== data.university) payload.university = parsedUni;

    const nextTiktok = tiktokHandle.trim() || null;
    if (nextTiktok !== (data.tiktokHandle ?? null)) {
      payload.tiktokHandle = nextTiktok;
    }

    if (parsedMembers !== (data.memberCount ?? null)) {
      payload.memberCount = parsedMembers;
    }

    if (category !== (data.category ?? null)) {
      payload.category = category;
    }

    if (parsedContact !== (data.contactName ?? null)) {
      payload.contactName = parsedContact;
    }
    const shippingDirty =
      !hasStructured ||
      ship.shippingLine1 !== (data.shippingLine1 ?? "") ||
      (ship.shippingLine2 ?? "") !== (data.shippingLine2 ?? "") ||
      ship.shippingCity !== (data.shippingCity ?? "") ||
      ship.shippingState !== (data.shippingState ?? "") ||
      ship.shippingPostalCode !== (data.shippingPostalCode ?? "");
    if (shippingDirty) {
      payload.shippingLine1 = ship.shippingLine1;
      payload.shippingLine2 = ship.shippingLine2 ?? null;
      payload.shippingCity = ship.shippingCity;
      payload.shippingState = ship.shippingState;
      payload.shippingPostalCode = ship.shippingPostalCode;
      if (ship.shippingPlaceId) {
        payload.shippingPlaceId = ship.shippingPlaceId;
      }
    }

    if (Object.keys(payload).length === 0) {
      setSaved(true);
      return;
    }

    try {
      await update.mutateAsync(payload);
      setSaved(true);
    } catch (err) {
      const mapped = userFacingApiError(
        err,
        "Could not save your profile. Please try again.",
      );
      setFieldErrors(mapped.fields);
      setError(mapped.banner);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md px-8 py-16 text-center text-sm font-medium text-buzz-inkMuted">
        Loading profile…
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-md px-8 py-16 text-center text-sm font-medium text-buzz-coral">
        Couldn’t load your profile. Please try again.
      </div>
    );
  }

  const igHandle = data.instagramHandle
    ? `@${data.instagramHandle.replace(/^@/, "")}`
    : "—";
  const followersDisplay =
    data.followerCount != null ? String(data.followerCount) : "—";

  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Org <span className="text-buzz-coral">Profile</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Keep your club details and shipping address up to date for brands.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        <div className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-buzz-inkMuted">
            Instagram identity (read-only)
          </p>
          <p className="mt-2 text-sm font-semibold text-buzz-ink">{igHandle}</p>
        </div>

        <EduEmailRotatePanel
          liveEmail={data.eduEmail}
          pendingEmail={data.pendingEduEmail}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["org-profile"] })
          }
        />

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Organization name
          </label>
          <input
            className={inputClass}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.orgName)}
            aria-describedby={
              fieldErrors.orgName ? "org-profile-org-name-error" : undefined
            }
          />
          <FieldError id="org-profile-org-name-error" message={fieldErrors.orgName} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            University
          </label>
          <input
            className={inputClass}
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.university)}
            aria-describedby={
              fieldErrors.university ? "org-profile-university-error" : undefined
            }
          />
          <FieldError
            id="org-profile-university-error"
            message={fieldErrors.university}
          />
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
            placeholder="@yourclub"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Instagram followers{" "}
            <span className="font-normal text-buzz-inkMuted">(from Instagram)</span>
          </label>
          <p className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-3 text-sm font-medium text-buzz-ink">
            {followersDisplay}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Number of members
          </label>
          <input
            type="number"
            min="0"
            className={inputClass}
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.memberCount)}
            aria-describedby={
              fieldErrors.memberCount ? "org-profile-member-count-error" : undefined
            }
          />
          <FieldError
            id="org-profile-member-count-error"
            message={fieldErrors.memberCount}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Organization type
          </label>
          <select
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
            className={inputClass}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.contactName)}
            aria-describedby={
              fieldErrors.contactName ? "org-profile-contact-name-error" : undefined
            }
          />
          <FieldError
            id="org-profile-contact-name-error"
            message={fieldErrors.contactName}
          />
        </div>

        <ShippingAddressFields
          value={shipping}
          onChange={setShipping}
          inputClass={inputClass}
          testIdPrefix="org-profile"
          error={fieldErrors.shipping}
          legacyHint={
            data.shippingLine1 ? null : (data.deliveryAddress ?? null)
          }
        />

        <button
          type="submit"
          disabled={update.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {update.isPending ? "Saving…" : "Save profile"}
        </button>

        {saved && !error && Object.keys(fieldErrors).length === 0 ? (
          <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
            Profile saved.
          </p>
        ) : null}
      </form>
    </div>
  );
}
