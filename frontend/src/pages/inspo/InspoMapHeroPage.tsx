/**
 * Brand map hero — Inspo US-map layout on cream/butter, coral accents.
 */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import UsCampusMap from "../../components/inspo/UsCampusMap";
import { TextField, Button } from "../../components/forms/controls";
import { GAP, PAD, SECTION_Y, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const GOALS = [
  "Build an ambassador program",
  "Engage content creators",
  "Drive app downloads",
  "Find product testers",
  "Increase social engagement",
  "Hire an intern",
] as const;

export function InspoMapHero() {
  const [goal, setGoal] = useState("Engage content creators");

  return (
    <section id="map" className={cn("mx-auto max-w-6xl scroll-mt-20 px-6", SECTION_Y)}>
      <div
        className={cn(
          "overflow-hidden rounded-buzzModal bg-gradient-to-br from-buzz-butter via-buzz-cream to-buzz-paper",
          PAD.roomy,
        )}
      >
        <div className="flex flex-col items-center gap-10 md:flex-row">
          <div className="min-w-0 flex-1">
            <h1 className={TEXT.display}>
              Tap into Gen Z
              <br />
              <span className="text-buzz-coral">everywhere</span>
            </h1>
            <p className={cn(TEXT.bodyLong, "mt-4 text-buzz-inkMuted")}>
              Tell us your goal. We&apos;ll handle the rest.
            </p>
            <form
              className="mt-8 flex items-center overflow-hidden rounded-full border border-buzz-lineMid bg-buzz-paper shadow-buzz"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="min-w-0 flex-1">
                <TextField
                  id="inspo-brand-goal"
                  size="compact"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className="h-10 border-0 bg-transparent focus:border-transparent focus:ring-0"
                />
              </div>
              <Button
                type="submit"
                size="compact"
                aria-label="Continue"
                className="m-1 h-10 w-10 shrink-0 rounded-full px-0"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <div className={cn("mt-6 flex flex-wrap", GAP.tight)}>
              {GOALS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGoal(item)}
                  className={
                    goal === item
                      ? "rounded-full border border-buzz-coral bg-buzz-coral px-3 py-1.5 text-xs font-medium text-buzz-paper"
                      : "rounded-full border border-buzz-lineMid bg-buzz-paper/70 px-3 py-1.5 text-xs font-medium text-buzz-ink hover:border-buzz-coral hover:text-buzz-coral"
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <UsCampusMap />
          </div>
        </div>
      </div>
    </section>
  );
}

export default InspoMapHero;
