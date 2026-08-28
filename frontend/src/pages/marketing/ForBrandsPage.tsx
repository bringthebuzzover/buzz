/**
 * /for-brands — public tour of ticket → admin draft → Publish (PRODUCT §5.2).
 */
import { Link } from "react-router-dom";
import TourFrame from "../../components/tours/TourFrame";

const STEPS = [
  "Apply (or accept an invite) with company name and email; Buzz reviews, then you set a password from the setup email.",
  "Plan your Campaign: send a ticket (message and optional notes). That text is not the campaign title — a representative will contact you.",
  "Sales call and logistics happen out of band. Buzz writes the drop creative and window.",
  "An admin saves an unpublished draft, then Publish. Only then do campus orgs see the campaign.",
  "You monitor applicants, KPIs, and a read-only tracker that starts at Awaiting Products.",
  "After the apply window closes, you batch-finalize (approve or deny) up to capacity.",
] as const;

export default function ForBrandsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-buzz-coral">
        For brands
      </p>
      <h1 className="mb-4 text-3xl font-black text-buzz-ink md:text-4xl">
        How brands run a <span className="text-buzz-coral">campaign</span>
      </h1>
      <p className="mb-10 text-base font-medium leading-relaxed text-buzz-inkMuted">
        You request a call. Buzz mints and publishes the drop. Brands do not
        create a live campaign from the portal or edit creative in this motion.
      </p>

      <h2 className="mb-3 text-lg font-bold text-buzz-ink">What you need</h2>
      <ul className="mb-10 list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        <li>Company name and a company email.</li>
        <li>Buzz review, then a setup-password email to reach the brand portal.</li>
        <li>
          After you are in, a drop request (ticket) — not a self-serve campaign
          builder.
        </li>
      </ul>

      <h2 className="mb-3 text-lg font-bold text-buzz-ink">How it works</h2>
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <TourFrame
        url="bringthebuzzover.com/brand/requests/new"
        caption="Plan your Campaign is a ticket. Buzz writes the drop after the call."
      >
        <p className="mb-3 text-sm font-semibold text-buzz-ink">
          Plan your Campaign
        </p>
        <label className="mb-1 block text-xs font-semibold text-buzz-ink">
          Message
        </label>
        <div className="mb-3 min-h-[4.5rem] rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-2 text-sm font-medium text-buzz-inkMuted">
          We&apos;d like a spring activation around trail running on a few
          campuses — happy to jump on a call.
        </div>
        <label className="mb-1 block text-xs font-semibold text-buzz-ink">
          Notes{" "}
          <span className="font-normal text-buzz-inkMuted">(optional)</span>
        </label>
        <div className="mb-3 rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-2 text-sm font-medium text-buzz-inkMuted">
          Prefer Northeast schools if possible.
        </div>
        <p className="rounded-lg border border-buzz-lineMid bg-buzz-butter px-3 py-2 text-xs font-medium text-buzz-ink">
          A representative will contact you. This request is not a live campaign.
        </p>
      </TourFrame>

      <TourFrame
        url="bringthebuzzover.com/brand/drops/campus-kickoff"
        caption="After Publish: read-only tracker starts at Awaiting Products."
      >
        <p className="mb-3 text-sm font-bold text-buzz-ink">Campus Kickoff 2026</p>
        <p className="mb-4 text-xs font-medium text-buzz-inkMuted">
          Published · Ithaca, NY
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["Awaiting Products", true],
              ["Drop Active", false],
              ["Drop Finished", false],
            ] as const
          ).map(([label, current]) => (
            <div
              key={label}
              className={`rounded-xl border px-2 py-3 text-center text-[11px] font-bold leading-snug ${
                current
                  ? "border-buzz-coral bg-buzz-butter"
                  : "border-buzz-lineMid bg-buzz-paper opacity-60"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </TourFrame>

      <TourFrame
        url="bringthebuzzover.com/brand/drops/campus-kickoff"
        caption="After the apply window closes, you approve or deny applicants (not during Open)."
      >
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-buzz-inkMuted">
          Finalize applicants
        </p>
        <ul className="space-y-2">
          <li className="flex items-center justify-between rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-2 text-sm">
            <span className="font-semibold text-buzz-ink">Cornell Outing Club</span>
            <span className="text-xs font-bold text-emerald-700">Approve</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-2 text-sm">
            <span className="font-semibold text-buzz-ink">Ithaca Running Club</span>
            <span className="text-xs font-bold text-buzz-inkMuted">Deny</span>
          </li>
        </ul>
      </TourFrame>

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <Link
          to="/brand/apply"
          className="inline-flex items-center justify-center rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
        >
          Apply as a brand
        </Link>
      </div>
    </div>
  );
}
