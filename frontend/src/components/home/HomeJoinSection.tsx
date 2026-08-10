/**
 * Public landing Join Us section. Two real account entry points: student orgs
 * sign in with Instagram (`/login`), brands submit a self-registration
 * application (`/brand/apply`).
 */
import { Link } from "react-router-dom";

export default function HomeJoinSection() {
  return (
    <section
      id="home-join"
      className="scroll-mt-28 border-t border-buzz-lineMid bg-buzz-butter px-8 py-16"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="mb-3 text-3xl font-bold text-buzz-ink md:text-4xl">
          Want to <span className="text-buzz-coral">join?</span>
        </h2>
        <p className="mx-auto mb-10 max-w-md text-sm font-medium text-buzz-inkMuted md:text-base">
          Pick the path that fits — sign in as a student organization, or apply
          as a brand.
        </p>

        <div className="mx-auto flex max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            to="/login"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-buzz-coral px-6 py-4 text-sm font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark sm:max-w-xs"
          >
            Join as Student Organization
          </Link>
          <Link
            to="/brand/apply"
            className="inline-flex flex-1 items-center justify-center rounded-lg border-2 border-buzz-coral bg-buzz-paper px-6 py-4 text-sm font-bold text-buzz-coral shadow-sm transition hover:bg-buzz-coral hover:text-buzz-paper sm:max-w-xs"
          >
            Apply as Brand
          </Link>
        </div>
      </div>
    </section>
  );
}
