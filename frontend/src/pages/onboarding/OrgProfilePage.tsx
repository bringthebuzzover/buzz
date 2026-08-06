/**
 * /onboarding/profile — org profile setup (Stage 7, Phase 2).
 *
 * Shown when user.status === "pending_org_profile". On submit it creates the
 * org profile, advances the account to pending_email_verification, and triggers
 * the .edu verification email; we then refresh the user so the route guard
 * forwards to /onboarding/verify-email.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSubmitOnboarding } from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import { pathForUser } from "../../utils/landing";
import {
  ORG_CATEGORY_OPTIONS,
  type OrgCategory,
} from "../../types/orgCategory";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

export default function OrgProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const submit = useSubmitOnboarding();

  const [orgName, setOrgName] = useState("");
  const [university, setUniversity] = useState("");
  const [eduEmail, setEduEmail] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user || user.status !== "pending_org_profile") {
    return <Navigate to={pathForUser(user)} replace />;
  }

  const signedInAs = user.instagramUsername
    ? `@${user.instagramUsername.replace(/^@/, "")}`
    : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await submit.mutateAsync({
        orgName: orgName.trim(),
        university: university.trim(),
        eduEmail: eduEmail.trim(),
        followerCount: followerCount ? Number(followerCount) : undefined,
        memberCount: memberCount ? Number(memberCount) : undefined,
        category: category || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
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
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Set Up Your <span className="text-buzz-coral">Org Profile</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Tell us about your organization to continue. Sign in with the
        organization&apos;s Instagram Business or Creator account — not a
        personal member account.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
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
            School (.edu) email
          </label>
          <input
            type="email"
            className={inputClass}
            value={eduEmail}
            onChange={(e) => setEduEmail(e.target.value)}
            placeholder="you@university.edu"
            required
          />
          <p className="mt-1 text-xs text-buzz-inkMuted">
            We'll send a verification link here.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Follower count <span className="font-normal text-buzz-inkMuted">(optional)</span>
          </label>
          <input
            type="number"
            min="0"
            className={inputClass}
            value={followerCount}
            onChange={(e) => setFollowerCount(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Number of members{" "}
            <span className="font-normal text-buzz-inkMuted">(optional)</span>
          </label>
          <input
            type="number"
            min="0"
            className={inputClass}
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Organization type{" "}
            <span className="font-normal text-buzz-inkMuted">(optional)</span>
          </label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as OrgCategory | "")}
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
            Shipping address{" "}
            <span className="font-normal text-buzz-inkMuted">(optional)</span>
          </label>
          <textarea
            className={inputClass}
            rows={2}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Where should brands ship products?"
          />
        </div>

        <button
          type="submit"
          disabled={submit.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submit.isPending ? "Submitting…" : "Continue"}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
