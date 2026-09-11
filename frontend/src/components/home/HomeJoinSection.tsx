/**
 * Public landing Join Us section. Two real account entry points: student orgs
 * apply at `/org/apply`, brands submit a self-registration application
 * (`/brand/apply`). Returning orgs use `/login`.
 */
import { LinkButton } from "../forms/controls";
import { GAP, SECTION_Y, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function HomeJoinSection() {
  return (
    <section
      id="home-join"
      className={cn("scroll-mt-28 border-t border-buzz-lineMid bg-buzz-butter px-8", SECTION_Y)}
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className={cn(TEXT.h2, "mb-3 text-buzz-ink md:text-4xl")}>
          Want to <span className="text-buzz-coral">join?</span>
        </h2>
        <p className={cn(TEXT.body, "mx-auto mb-10 max-w-md font-medium text-buzz-inkMuted md:text-base")}>
          Pick the path that fits — apply as a student organization, or apply
          as a brand.
        </p>

        <div className={cn("mx-auto flex max-w-md flex-col sm:max-w-none sm:flex-row sm:justify-center", GAP.default)}>
          <LinkButton
            to="/org/apply"
            size="hero"
            fullWidth
            className="sm:max-w-xs"
          >
            Join as Student Organization
          </LinkButton>
          <LinkButton
            to="/brand/apply"
            variant="outline"
            size="hero"
            fullWidth
            className="sm:max-w-xs"
          >
            Apply as Brand
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
