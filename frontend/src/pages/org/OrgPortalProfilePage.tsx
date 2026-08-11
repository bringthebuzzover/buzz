/**
 * `/org/profile` — view/edit org profile after onboarding (PRODUCT.md §3.1).
 *
 * Distinct from `/onboarding/profile`, which creates the org row. Edu email and
 * Instagram handle are login identity (read-only); follower count is Graph-owned
 * (read-only). Editable fields PATCH via `/api/orgs/me`.
 */
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import {
  useOrgProfile,
  useUpdateOrgProfile,
  type OrgProfileUpdate,
} from "../../api/hooks/useOrgHooks";
import {
  ORG_CATEGORY_OPTIONS,
  type OrgCategory,
} from "../../types/orgCategory";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

export default function OrgPortalProfilePage() {
  const { data, isLoading, error: loadError } = useOrgProfile();
  const update = useUpdateOrgProfile();

  const [orgName, setOrgName] = useState("");
  const [university, setUniversity] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [contactName, setContactName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setOrgName(data.orgName);
    setUniversity(data.university);
    setTiktokHandle(data.tiktokHandle ?? "");
    setMemberCount(data.memberCount != null ? String(data.memberCount) : "");
    setCategory((data.category as OrgCategory | null) ?? "");
    setCity(data.city ?? "");
    setState(data.state ?? "");
    setContactName(data.contactName ?? "");
    setDeliveryAddress(data.deliveryAddress ?? "");
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setError(null);
    setSaved(false);

    if (!category) {
      setError("Select an organization type.");
      return;
    }
    const nextMembers = Number(memberCount);
    if (
      memberCount.trim() === "" ||
      Number.isNaN(nextMembers) ||
      nextMembers < 0
    ) {
      setError("Enter a valid member count.");
      return;
    }
    const nextCity = city.trim();
    const nextState = state.trim();
    const nextContact = contactName.trim();
    const nextAddress = deliveryAddress.trim();
    if (!nextCity || !nextState || !nextContact || !nextAddress) {
      setError("City, state, contact name, and shipping address are required.");
      return;
    }

    const payload: OrgProfileUpdate = {};
    const nextName = orgName.trim();
    const nextUniversity = university.trim();
    if (nextName !== data.orgName) payload.orgName = nextName;
    if (nextUniversity !== data.university) payload.university = nextUniversity;

    const nextTiktok = tiktokHandle.trim() || null;
    if (nextTiktok !== (data.tiktokHandle ?? null)) {
      payload.tiktokHandle = nextTiktok;
    }

    if (nextMembers !== (data.memberCount ?? null)) {
      payload.memberCount = nextMembers;
    }

    if (category !== (data.category ?? null)) {
      payload.category = category;
    }

    if (nextCity !== (data.city ?? null)) payload.city = nextCity;
    if (nextState !== (data.state ?? null)) payload.state = nextState;
    if (nextContact !== (data.contactName ?? null)) {
      payload.contactName = nextContact;
    }
    if (nextAddress !== (data.deliveryAddress ?? null)) {
      payload.deliveryAddress = nextAddress;
    }

    if (Object.keys(payload).length === 0) {
      setSaved(true);
      return;
    }

    try {
      await update.mutateAsync(payload);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save your profile. Please try again.",
      );
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
        <div className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-buzz-inkMuted">
            Login identity (read-only)
          </p>
          <p className="mt-2 text-sm font-semibold text-buzz-ink">{igHandle}</p>
          <p className="mt-1 text-sm text-buzz-inkMuted">
            {data.eduEmail || "No .edu email on file"}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Organization name
          </label>
          <input
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
            className={inputClass}
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            required
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-buzz-ink">
              City
            </label>
            <input
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-buzz-ink">
              State
            </label>
            <input
              className={inputClass}
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
            />
          </div>
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
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Shipping address
          </label>
          <textarea
            className={inputClass}
            rows={2}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Where should brands ship products?"
            required
          />
        </div>

        <button
          type="submit"
          disabled={update.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {update.isPending ? "Saving…" : "Save profile"}
        </button>

        {saved && !error ? (
          <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
            Profile saved.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
