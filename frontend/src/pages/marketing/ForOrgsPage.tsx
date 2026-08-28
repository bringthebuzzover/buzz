/**
 * /for-orgs — public tour of apply-first org onboarding (PRODUCT §6.1 / §6.1.1).
 */
import { Link } from "react-router-dom";
import TourFrame from "../../components/tours/TourFrame";

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
    <div className="mx-auto max-w-3xl px-8 py-16">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-buzz-coral">
        For student organizations
      </p>
      <h1 className="mb-4 text-3xl font-black text-buzz-ink md:text-4xl">
        How orgs join <span className="text-buzz-coral">Buzz</span>
      </h1>
      <p className="mb-10 text-base font-medium leading-relaxed text-buzz-inkMuted">
        You apply on the website first. Instagram login comes after Buzz
        approves you — it binds the organization account, it does not create a
        new one.
      </p>

      <h2 className="mb-3 text-lg font-bold text-buzz-ink">What you need</h2>
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

      <h2 className="mb-3 text-lg font-bold text-buzz-ink">How it works</h2>
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-relaxed text-buzz-inkMuted">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <TourFrame
        url="bringthebuzzover.com/org/apply"
        caption="Apply: type the org handle, then confirm the card on the same page."
      >
        <p className="mb-3 rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-3 text-xs font-medium text-buzz-inkMuted">
          Your Instagram must be the organization&apos;s{" "}
          <span className="font-semibold text-buzz-ink">Business or Creator</span>{" "}
          account — not a personal member profile. Personal accounts cannot be
          used on Buzz.
        </p>
        <label className="mb-1 block text-xs font-semibold text-buzz-ink">
          Instagram handle
        </label>
        <div className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-2 text-sm font-medium text-buzz-ink">
          cornellouting
        </div>
        <div className="mt-3 rounded-lg border border-buzz-lineMid bg-buzz-paper p-3 text-left">
          <div className="flex gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-buzz-butter text-xs font-bold text-buzz-ink"
              aria-hidden
            >
              CO
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-buzz-ink">@cornellouting</p>
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
            className="mt-3 w-full cursor-default rounded-lg bg-buzz-coral px-3 py-2 text-sm font-bold text-buzz-paper"
          >
            Confirm this is our organization&apos;s account.
          </button>
        </div>
      </TourFrame>

      <TourFrame
        url="bringthebuzzover.com/org/browse"
        caption="Drop Feed: only campaigns Buzz has published — not tickets or drafts."
      >
        <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-butter">
          <div className="relative h-28 bg-gradient-to-br from-buzz-coral/80 to-buzz-ink/70">
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="rounded-full bg-buzz-coral px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-paper">
                Northstar Athletics
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Open
              </span>
            </div>
          </div>
          <div className="p-4">
            <h3 className="mb-1 text-lg font-bold text-buzz-coral">
              Campus Kickoff 2026
            </h3>
            <p className="mb-3 text-xs font-medium text-buzz-inkMuted">
              Ithaca, NY · Up to 8 spots
            </p>
            <button
              type="button"
              tabIndex={-1}
              className="w-full cursor-default rounded-lg bg-buzz-coral py-2 text-sm font-semibold text-buzz-paper"
            >
              Apply
            </button>
          </div>
        </div>
      </TourFrame>

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <Link
          to="/org/apply"
          className="inline-flex items-center justify-center rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
        >
          Apply as a student organization
        </Link>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Already connected Instagram?{" "}
          <Link to="/login" className="font-bold text-buzz-coral hover:underline">
            Org login
          </Link>
        </p>
      </div>
    </div>
  );
}
