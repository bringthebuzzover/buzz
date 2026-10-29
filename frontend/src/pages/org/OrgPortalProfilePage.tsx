/**
 * `/org/profile` — view/edit org profile after onboarding (buzz-ops product/PRODUCT.md §3.1).
 *
 * Distinct from `/onboarding/profile`, which creates the org row. Instagram
 * handle is login identity (request-change modal, not PATCH). .edu rotates via
 * pending-swap APIs (not PATCH). Follower count is Graph-owned (read-only).
 * Other fields PATCH via `/api/orgs/me`.
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { userFacingApiError } from "../../api/userFacingError";
import FieldError from "../../components/forms/FieldError";
import {
  Button,
  ErrorBanner,
  Select,
  SuccessBanner,
  TextField,
} from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { Loader } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatePanel } from "../../components/ui/StatePanel";
import { fieldClass, fieldLabelClass } from "../../theme/controls";
import { cn } from "../../theme/cn";
import {
  useOrgProfile,
  useUpdateOrgProfile,
  type OrgProfileUpdate,
} from "../../api/hooks/useOrgHooks";
import EduEmailRotatePanel from "../../components/org/EduEmailRotatePanel";
import IgChangeRequestPanel from "../../components/org/IgChangeRequestPanel";
import IgPreviousAccountBanner from "../../components/org/IgPreviousAccountBanner";
import ShippingAddressFields, {
  EMPTY_SHIPPING,
  shippingToApi,
  type ShippingAddressValue,
} from "../../components/org/ShippingAddressFields";
import { ORG_CATEGORY_OPTIONS, type OrgCategory } from "../../types/orgCategory";
import {
  isFieldError,
  parseMemberCount,
  requireNonBlank,
  unwrapParsed,
} from "../../utils/formValidation";

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

  const header = (
    <PageHeader
      className="mb-10"
      kicker="Organization Portal"
      title="Profile"
      description="Keep your club details and shipping address up to date for brands."
    />
  );

  if (isLoading) {
    return (
      <PageShell width="wide">
        {header}
        <Loader label="Loading profile…" className="py-16" />
      </PageShell>
    );
  }

  if (loadError || !data) {
    return (
      <PageShell width="wide">
        {header}
        <StatePanel tone="danger">
          Couldn’t load your profile. Please try again.
        </StatePanel>
      </PageShell>
    );
  }

  const igHandle = data.instagramHandle
    ? `@${data.instagramHandle.replace(/^@/, "")}`
    : "—";
  const followersDisplay = data.followerCount != null ? String(data.followerCount) : "—";

  return (
    <PageShell width="wide">
      {header}

      <div className="flex flex-col gap-6">
        <div className="grid items-start gap-6 md:grid-cols-2">
          <IgChangeRequestPanel
            currentHandle={igHandle.replace(/^@/, "")}
            connectEmail={data.eduEmail}
          />
          <EduEmailRotatePanel
            liveEmail={data.eduEmail}
            pendingEmail={data.pendingEduEmail}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["org-profile"] })}
          />
        </div>
        <IgPreviousAccountBanner />

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}

          <Card kind="panel" pad="card">
            <CardHeader className="mb-5" title="Details" />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <TextField
                  id="org-profile-org-name"
                  label="Organization name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  aria-invalid={Boolean(fieldErrors.orgName)}
                  aria-describedby={
                    fieldErrors.orgName ? "org-profile-org-name-error" : undefined
                  }
                />
                <FieldError
                  id="org-profile-org-name-error"
                  message={fieldErrors.orgName}
                />
              </div>

              <div>
                <TextField
                  id="org-profile-university"
                  label="University"
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

              <TextField
                id="org-profile-tiktok"
                label={
                  <>
                    TikTok handle{" "}
                    <span className="font-normal text-quiet">(optional)</span>
                  </>
                }
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="@yourclub"
              />

              <div>
                <p className={fieldLabelClass}>
                  Instagram followers{" "}
                  <span className="font-normal text-quiet">(from Instagram)</span>
                </p>
                <p className={cn(fieldClass.default, "flex items-center text-primary")}>
                  {followersDisplay}
                </p>
              </div>

              <div>
                <TextField
                  id="org-profile-member-count"
                  type="number"
                  min="0"
                  label="Number of members"
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

              <Select
                id="org-profile-category"
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

              <div className="md:col-span-2">
                <TextField
                  id="org-profile-contact-name"
                  label="Contact name"
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
            </div>
          </Card>

          <Card kind="panel" pad="card">
            <ShippingAddressFields
              value={shipping}
              onChange={setShipping}
              testIdPrefix="org-profile"
              error={fieldErrors.shipping}
              legacyHint={data.shippingLine1 ? null : (data.deliveryAddress ?? null)}
            />
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save profile"}
            </Button>
          </div>

          {saved && !error && Object.keys(fieldErrors).length === 0 ? (
            <SuccessBanner>Profile saved.</SuccessBanner>
          ) : null}
        </form>
      </div>
    </PageShell>
  );
}
