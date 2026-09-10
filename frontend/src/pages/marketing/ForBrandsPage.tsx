/**
 * /for-brands — public tour of ticket → admin draft → Publish (PRODUCT §5.2).
 */
import TourFrame from "../../components/tours/TourFrame";
import PageShell from "../../components/site/PageShell";
import { LinkButton } from "../../components/forms/controls";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

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
    <PageShell width="reading">
      <p className={cn(TEXT.micro, "mb-2 font-semibold text-buzz-coral")}>
        For brands
      </p>
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-ink md:text-4xl")}>
        How brands run a <span className="text-buzz-coral">campaign</span>
      </h1>
      <p className={cn(TEXT.bodyLong, "mb-10 font-medium text-buzz-inkMuted")}>
        You request a call. Buzz mints and publishes the drop. Brands do not
        create a live campaign from the portal or edit creative in this motion.
      </p>

      <h2 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>What you need</h2>
      <ul className="mb-10 list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        <li>Company name and a company email.</li>
        <li>Buzz review, then a setup-password email to reach the brand portal.</li>
        <li>
          After you are in, a drop request (ticket) — not a self-serve campaign
          builder.
        </li>
      </ul>

      <h2 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>How it works</h2>
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
        <div className={cn(SURFACE.inset, "mb-3 min-h-[4.5rem] px-3 py-2 text-sm font-medium text-buzz-inkMuted")}>
          We&apos;d like a spring activation around trail running on a few
          campuses — happy to jump on a call.
        </div>
        <label className="mb-1 block text-xs font-semibold text-buzz-ink">
          Notes{" "}
          <span className="font-normal text-buzz-inkMuted">(optional)</span>
        </label>
        <div className={cn(SURFACE.inset, "mb-3 px-3 py-2 text-sm font-medium text-buzz-inkMuted")}>
          Prefer Northeast schools if possible.
        </div>
        <p className={cn(SURFACE.cardWarm, "px-3 py-2 text-xs font-medium text-buzz-ink")}>
          A representative will contact you. This request is not a live campaign.
        </p>
      </TourFrame>

      <TourFrame
        url="bringthebuzzover.com/brand/drops/campus-kickoff"
        caption="After Publish: read-only tracker starts at Awaiting Products."
      >
        <p className="mb-3 text-sm font-semibold text-buzz-ink">Campus Kickoff 2026</p>
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
              className={cn(
                "rounded-buzzControl border px-2 py-3 text-center text-buzzMicro font-semibold leading-snug",
                current
                  ? "border-buzz-coral bg-buzz-butter"
                  : "border-buzz-lineMid bg-buzz-paper opacity-60",
              )}
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
        <p className={cn(TEXT.micro, "mb-3 font-semibold text-buzz-inkMuted")}>
          Finalize applicants
        </p>
        <ul className="space-y-2">
          <li className={cn(SURFACE.inset, "flex items-center justify-between px-3 py-2 text-sm")}>
            <span className="font-semibold text-buzz-ink">Cornell Outing Club</span>
            <span className="text-xs font-semibold text-buzz-success">Approve</span>
          </li>
          <li className={cn(SURFACE.inset, "flex items-center justify-between px-3 py-2 text-sm")}>
            <span className="font-semibold text-buzz-ink">Ithaca Running Club</span>
            <span className="text-xs font-semibold text-buzz-inkMuted">Deny</span>
          </li>
        </ul>
      </TourFrame>

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <LinkButton to="/brand/apply">Apply as a brand</LinkButton>
      </div>
    </PageShell>
  );
}
