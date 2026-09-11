/**
 * /for-orgs — public tour of apply-first org onboarding (PRODUCT §6.1 / §6.1.1).
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
  "Fill out the public apply form (profile, campus .edu, shipping address).",
  "Type your organization’s Instagram handle and wait for the same-page confirm card.",
  "Confirm that Business or Creator account, then submit.",
  "Verify the .edu email Buzz sends you (check Junk on campus Outlook).",
  "Wait while Buzz reviews and adds your handle as an Instagram Tester.",
  "Accept the tester invite, then Connect Instagram on the org account.",
  "Browse published campaigns on the Drop Feed and Apply when a drop is Open.",
  "If you’re accepted, products ship to the address you gave; post from that org Instagram.",
] as const;

export default function ForOrgsPage() {
  return (
    <PageShell width="reading">
      <p className={cn(TEXT.micro, "mb-2 font-semibold text-buzz-coral")}>
        For student organizations
      </p>
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-ink md:text-4xl")}>
        How orgs join <span className="text-buzz-coral">Buzz</span>
      </h1>
      <p className={cn(TEXT.bodyLong, "mb-10 font-medium text-buzz-inkMuted")}>
        You apply on the website first. Instagram login comes after Buzz
        approves you — it binds the organization account, it does not create a
        new one.
      </p>

      <h2 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>What you need</h2>
      <ul className="mb-10 list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        <li>
          The organization’s Instagram{" "}
          <span className="font-semibold text-buzz-ink">Business or Creator</span>{" "}
          account — not a member’s personal profile.
        </li>
        <li>A campus <span className="font-semibold text-buzz-ink">.edu</span> email you can verify.</li>
        <li>
          Org name, university, member count, type, city, state, contact name,
          and a shipping address (free text — you’ll give where products should
          go).
        </li>
        <li>Buzz review after you verify. Portal access starts after you Connect Instagram.</li>
      </ul>

      <h2 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>How it works</h2>
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <TourFrame
        url="bringthebuzzover.com/org/apply"
        caption="Apply: type the org handle, then confirm the card on the same page."
      >
        <p className={cn(SURFACE.inset, "mb-3 px-3 py-3 text-xs font-medium text-buzz-inkMuted")}>
          Your Instagram must be the organization&apos;s{" "}
          <span className="font-semibold text-buzz-ink">Business or Creator</span>{" "}
          account — not a personal member profile. Personal accounts cannot be
          used on Buzz.
        </p>
        <label className="mb-1 block text-xs font-semibold text-buzz-ink">
          Instagram handle
        </label>
        <div className={cn(SURFACE.inset, "px-3 py-2 text-sm font-medium text-buzz-ink")}>
          cornellouting
        </div>
        <div className={cn(SURFACE.inset, "mt-3 p-3 text-left")}>
          <div className="flex gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-buzz-butter text-xs font-semibold text-buzz-ink"
              aria-hidden
            >
              CO
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-buzz-ink">@cornellouting</p>
              <p className="truncate text-sm font-medium text-buzz-inkMuted">
                Cornell Outing Club
              </p>
              <p className="text-xs text-buzz-inkMuted">2,410 followers</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-buzz-inkMuted">
            Outdoor trips and trail days for Cornell students.
          </p>
          <button
            type="button"
            tabIndex={-1}
            className="mt-3 w-full cursor-default rounded-buzzControl bg-buzz-coral px-3 py-2 text-sm font-semibold text-buzz-paper"
          >
            Confirm this is our organization&apos;s account.
          </button>
        </div>
      </TourFrame>

      <TourFrame
        url="bringthebuzzover.com/org/browse"
        caption="Drop Feed: only campaigns Buzz has published — not tickets or drafts."
      >
        <Card kind="cardWarm" pad="none" className="overflow-hidden">
          <div className="relative h-28 bg-gradient-to-br from-buzz-coral/80 to-buzz-ink/70">
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <Chip accent>Northstar Athletics</Chip>
              <Chip tone="success">Open</Chip>
            </div>
          </div>
          <div className="p-4">
            <h3 className={cn(TEXT.h3, "mb-1 text-buzz-coral")}>
              Campus Kickoff 2026
            </h3>
            <p className="mb-3 text-xs font-medium text-buzz-inkMuted">
              Ithaca, NY · Up to 8 spots
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

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <LinkButton to="/org/apply">Apply as a student organization</LinkButton>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Already connected Instagram?{" "}
          <Link to="/login" className="font-semibold text-buzz-coral hover:underline">
            Org login
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
