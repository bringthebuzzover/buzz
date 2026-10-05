/**
 * /for-creators — public tour of how an individual student creator joins.
 */
import { Link } from "react-router-dom";
import TourFrame from "../../components/tours/TourFrame";
import PageShell from "../../components/site/PageShell";
import { Chip } from "../../components/ui/Chip";
import { Card } from "../../components/ui/Card";
import { LinkButton } from "../../components/forms/controls";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const STEPS = [
  "Apply with your name, campus, a .edu email, and your Instagram handle.",
  "Verify the .edu email Buzz sends you (check Junk on campus Outlook).",
  "Wait while Buzz reviews your profile, usually about two business days.",
  "Connect your Instagram so brands see your real follower count.",
  "Browse digital Drops and Apply with a short pitch while a Drop is Open.",
  "If you’re chosen, post from your own Instagram and link that post on Buzz.",
  "Buzz pays you the full fee once the brand accepts your post.",
] as const;

const TOUR_DROP_IMAGE =
  "https://res.cloudinary.com/wffcoxs0/image/upload/f_auto,q_auto/UPDATE_x_BUZZ_600_x_400_px";

export default function ForCreatorsPage() {
  return (
    <PageShell width="reading">
      <p className={cn(TEXT.micro, "mb-2 font-semibold text-buzz-coral")}>
        For student creators
      </p>
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-ink md:text-4xl")}>
        How student creators join <span className="text-buzz-coral">Buzz</span>
      </h1>
      <p className={cn(TEXT.bodyLong, "mb-10 font-medium text-buzz-inkMuted")}>
        Brands book student creators for digital Drops: you post from your own
        Instagram, nothing ships, and you keep the whole fee. Buzz&apos;s fee is
        billed to the brand.
      </p>

      <h2 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>What you need</h2>
      <ul className="mb-10 list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        <li>A campus <span className="font-semibold text-buzz-ink">.edu</span> email you can verify.</li>
        <li>
          Your own Instagram{" "}
          <span className="font-semibold text-buzz-ink">Creator or Business</span>{" "}
          account. An organization&apos;s account applies at{" "}
          <Link to="/for-orgs" className="font-semibold text-buzz-coral hover:underline">
            For orgs
          </Link>
          .
        </li>
        <li>No shipping address. Creator Drops are digital.</li>
      </ul>

      <h2 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>How it works</h2>
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <TourFrame
        url="bringthebuzzover.com/creators/apply"
        caption="Apply: your campus, your .edu, your handle, and what you make."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TourField label="School" value="Cornell University" />
          <TourField label="Campus .edu email" value="jacey@cornell.edu" />
        </div>
        <div className="mt-3">
          <TourField label="Instagram handle" value="@jaceystudies" />
        </div>
        <p className="mb-1 mt-3 text-xs font-semibold text-buzz-ink">Niches</p>
        <div className="flex flex-wrap gap-2">
          <Chip tone="success">College lifestyle</Chip>
          <Chip tone="success">Fitness</Chip>
          <Chip>Food</Chip>
        </div>
      </TourFrame>

      <TourFrame
        url="bringthebuzzover.com/creators/feed"
        caption="Browse Campaigns: digital Drops with a set number of creator seats."
      >
        <Card kind="cardWarm" pad="none" className="overflow-hidden">
          <div className="relative h-48 overflow-hidden border-b border-buzz-lineMid">
            <img
              src={TOUR_DROP_IMAGE}
              alt="Finals Week Reel"
              className="h-full w-full object-cover"
            />
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <Chip accent>UPDATE</Chip>
              <Chip tone="success">Open</Chip>
            </div>
          </div>
          <div className="p-4">
            <h3 className={cn(TEXT.h3, "mb-1 text-buzz-coral")}>Finals Week Reel</h3>
            <p className="mb-3 text-xs font-medium text-buzz-inkMuted">
              Digital · 2 creator seats · $400 per creator
            </p>
            <button
              type="button"
              tabIndex={-1}
              className="w-full cursor-default rounded-buzzControl bg-buzz-coral py-2 text-sm font-semibold text-buzz-paper"
            >
              Apply
            </button>
          </div>
        </Card>
      </TourFrame>

      <TourFrame
        url="bringthebuzzover.com/creators/campaigns"
        caption="My Campaigns: link the post you made. Your fee is yours in full."
      >
        <Chip tone="success">Accepted · link your post</Chip>
        <p className={cn(TEXT.h3, "mt-3 text-buzz-ink")}>UPDATE · Finals Week Reel</p>
        <p className={cn(TEXT.metric, "mt-3 text-buzz-ink")}>$400</p>
        <p className="text-xs font-medium text-buzz-inkMuted">
          Your fee, in full. Buzz&apos;s fee is billed to the brand on top.
        </p>
        <div className={cn(SURFACE.inset, "mt-3 px-3 py-2 text-sm font-medium text-buzz-ink")}>
          Reel · My finals week study routine
        </div>
      </TourFrame>

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <LinkButton to="/creators/apply">Apply as a student creator</LinkButton>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Run a student organization?{" "}
          <Link to="/for-orgs" className="font-semibold text-buzz-coral hover:underline">
            See how organizations join
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

function TourField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-buzz-ink">{label}</p>
      <div className={cn(SURFACE.inset, "px-3 py-2 text-sm font-medium text-buzz-ink")}>
        {value}
      </div>
    </div>
  );
}
