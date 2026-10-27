/**
 * How it works — three collab types inside a butter wash panel.
 */
import { Search } from "lucide-react";
import sorority from "../../assets/sorority.png";
import ztaLacroix from "../../assets/sorority.png";
import { LinkButton } from "../../components/forms/controls";
import { Card } from "../../components/ui/Card";
import { GAP, PAD, SECTION_Y, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const CARDS = [
  {
    title: "Brand ambassadors",
    body: "Students represent your brand while driving awareness and creating campus connections.",
    image: ztaLacroix,
  },
  {
    title: "UGC creators",
    body: "Students create relatable content that puts your brand authentically in front of Gen Z.",
    image: sorority,
  },
  {
    title: "Interns",
    body: "Students drive meaningful impact across marketing, social, and campus ops.",
    image: ztaLacroix,
  },
] as const;

const STUDENTS = [
  { name: "Emily", wash: "bg-buzz-butter" },
  { name: "Sophia", wash: "bg-buzz-coralLight" },
  { name: "Ava", wash: "bg-buzz-cream" },
  { name: "Mia", wash: "bg-buzz-lineMid" },
] as const;

export function InspoHowItWorks() {
  return (
    <section
      id="how-it-works"
      className={cn("mx-auto max-w-6xl scroll-mt-20 px-6", SECTION_Y)}
    >
      <h2 className={cn(TEXT.h1, "mb-8 text-center")}>
        How it <span className="text-buzz-coral">works</span>
      </h2>
      <div
        className={cn(
          "overflow-hidden rounded-buzzModal bg-gradient-to-b from-buzz-butter to-buzz-cream",
          PAD.roomy,
        )}
      >
        <p
          className={cn(
            TEXT.micro,
            "mb-6 text-center font-semibold tracking-wide text-buzz-inkMuted",
          )}
        >
          Campaign
        </p>
        <div className="flex flex-col items-center gap-10 md:flex-row">
          <div className="min-w-0 flex-1">
            <h3 className={TEXT.h2}>
              Access Gen Z at scale.
              <br />
              All in one place.
            </h3>
            <p className={cn(TEXT.body, "mt-3 max-w-sm text-buzz-inkMuted")}>
              Work with the best student talent on campuses across the U.S.
            </p>
            <LinkButton to="/brand/apply" className="mt-6">
              List a campaign
            </LinkButton>
          </div>
          <Card kind="cardFlat" pad="default" className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2 rounded-full bg-buzz-cream px-3 py-2 text-sm text-buzz-inkMuted">
              <Search className="h-4 w-4" />
              Search students
            </div>
            <div className={cn("grid grid-cols-4", GAP.tight)}>
              {STUDENTS.map((student) => (
                <div
                  key={student.name}
                  className={cn(SURFACE.inset, "overflow-hidden p-0")}
                >
                  <div className={cn("h-16", student.wash)} />
                  <p
                    className={cn(
                      TEXT.micro,
                      "px-1 py-1 text-center font-medium normal-case tracking-normal",
                    )}
                  >
                    {student.name}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className={cn("mt-10 grid md:grid-cols-3", GAP.default)}>
          {CARDS.map((card) => (
            <Card
              key={card.title}
              kind="cardFlat"
              pad="none"
              className="overflow-hidden"
            >
              <img
                src={card.image}
                alt=""
                className="h-40 w-full object-cover"
              />
              <div className={PAD.default}>
                <h3 className={TEXT.h3}>{card.title}</h3>
                <p className={cn(TEXT.body, "mt-1 text-buzz-inkMuted")}>
                  {card.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default InspoHowItWorks;
