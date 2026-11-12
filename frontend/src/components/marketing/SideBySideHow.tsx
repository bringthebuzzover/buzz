import { cn } from "../../theme/cn";
import { SECTION_Y, TEXT } from "../../theme/tokens";
import { ORG_LAPTOP_STEPS, BRAND_LAPTOP_STEPS } from "./mockups";
import { LaptopMockup } from "./LaptopMockup";

const CARD_BACKGROUNDS = ["bg-[#fdf3cb]", "bg-[#fef08a]", "bg-[#fd6581]"];

export function SideBySideHow({ kind }: { kind: "org" | "brand" }) {
  const steps = kind === "org" ? ORG_LAPTOP_STEPS : BRAND_LAPTOP_STEPS;
  const title = kind === "brand" ? "Brand portal" : "How it works";

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      data-nav-surface="paper"
      className={cn("bg-[#f0f0f0] px-4 text-on-accent md:px-12", SECTION_Y)}
    >
      <h2 id="how-it-works-title" className={cn(TEXT.h2, "text-center")}>
        {title}
      </h2>
      <ol className="mx-auto mt-12 grid max-w-6xl list-none grid-cols-1 gap-8 xl:grid-cols-3 xl:gap-6">
        {steps.map((step, index) => (
          <li key={step.title} className="flex min-w-0 flex-col">
            <div
              className={cn(
                "flex items-center justify-center overflow-hidden rounded-buzzBoard px-4 py-8 md:px-6 md:py-10",
                CARD_BACKGROUNDS[index],
              )}
            >
              <LaptopMockup
                videoMp4={step.videoMp4}
                videoWebm={step.videoWebm}
                poster={step.poster}
                alt={step.alt}
              />
            </div>
            <h3 className={cn(TEXT.h3, "mt-6 leading-[1.4]")}>
              <span className="mr-2">{index + 1}</span> {step.title}
            </h3>
            <p className="mt-2 text-base leading-[1.4] text-on-accent/60">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

