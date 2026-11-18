import { cn } from "../../theme/cn";
import { SECTION_X, SECTION_Y } from "../../theme/tokens";
import { ORG_LAPTOP_STEPS, BRAND_LAPTOP_STEPS } from "./mockups";
import { LaptopMockup } from "./LaptopMockup";

const CARD_BACKGROUNDS = ["bg-[#fdf3cb]", "bg-[#fef08a]", "bg-[#fd6581]"];

export function SideBySideHow({ kind }: { kind: "org" | "brand" }) {
  const steps = kind === "org" ? ORG_LAPTOP_STEPS : BRAND_LAPTOP_STEPS;
  const title = kind === "brand" ? "Execute your campus activations" : "Partner with brands";
  const subtitle =
    kind === "brand"
      ? "Request a campaign. BUZZ runs the drop. Organizations post."
      : "Merch and product samples for your organization.";

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      data-nav-surface="ink"
      className={cn("bg-page text-primary", SECTION_X, SECTION_Y)}
    >
      <div className="mx-auto max-w-4xl text-center mb-12 md:mb-16">
        <h2 id="how-it-works-title" className="text-[32px] font-bold tracking-tight text-accent md:text-buzzH2">
          {title}
        </h2>
        <p className="mt-3 text-[22px] font-medium leading-snug text-primary md:text-[28px]">
          {subtitle}
        </p>
      </div>
      <ol className="mx-auto grid max-w-6xl list-none grid-cols-1 gap-10 xl:grid-cols-3 xl:gap-8">
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
            <h3 className="mt-6 text-xl font-bold leading-snug text-primary">
              <span className="mr-2 text-accent">{index + 1}</span> {step.title}
            </h3>
            <p className="mt-2 text-base leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

