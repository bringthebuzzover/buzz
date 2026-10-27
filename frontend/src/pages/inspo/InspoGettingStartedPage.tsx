/**
 * Getting started — three phone columns on brand washes.
 */
import PhoneBezel from "../../components/inspo/PhoneBezel";
import sorority from "../../assets/sorority.png";
import ztaLacroix from "../../assets/sorority.png";
import { GAP, SECTION_Y, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const STEPS = [
  {
    wash: "bg-buzz-butter",
    title: "Build your profile",
    body: "Post the moments you’re already hosting — dinners, showcases, and campus nights. Host experiences as you plan them.",
    inner: "profile" as const,
  },
  {
    wash: "bg-buzz-butterBright",
    title: "Apply to brands",
    body: "Browse brand partners across food, beverage, and apparel. Explore the catalog in every category.",
    inner: "apply" as const,
  },
  {
    wash: "bg-buzz-coralLight",
    title: "Share the experience",
    body: "Feature brand products at your event, capture the photos, tag partners, and post the recap.",
    inner: "share" as const,
  },
] as const;

function PhoneInner({ kind }: { kind: (typeof STEPS)[number]["inner"] }) {
  if (kind === "profile") {
    return (
      <div className="px-4 pb-6 pt-10 text-center">
        <img
          src={sorority}
          alt=""
          className="mx-auto h-20 w-20 rounded-full object-cover"
        />
        <p className={cn(TEXT.body, "mt-3 font-semibold")}>Rebecca Taylor</p>
        <p className={TEXT.meta}>Event manager</p>
        <p className={cn(TEXT.meta, "mt-2")}>East Islip, New York, USA</p>
        <p className={cn(TEXT.meta, "mt-4 text-left leading-relaxed")}>
          We&apos;re passionate about sharing meaningful products and
          experiences that celebrate modern hosting.
        </p>
      </div>
    );
  }
  if (kind === "apply") {
    return (
      <div className="bg-buzz-cream px-3 pb-6 pt-10">
        <div className={cn(SURFACE.card, "overflow-hidden")}>
          <img src={ztaLacroix} alt="" className="h-28 w-full object-cover" />
          <div className="p-3">
            <p className={cn(TEXT.body, "font-semibold")}>goodwipes</p>
            <p className={cn(TEXT.meta, "mt-1 leading-relaxed")}>
              About this brand — campus sampling kits and event partnerships.
            </p>
            <span className="mt-3 inline-block rounded-full bg-buzz-coral px-3 py-1 text-xs font-semibold text-buzz-paper">
              Apply
            </span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-[420px]">
      <img src={sorority} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

export function InspoGettingStarted() {
  return (
    <section
      id="getting-started"
      className={cn("mx-auto max-w-6xl scroll-mt-20 px-6", SECTION_Y)}
    >
      <h2 className={cn(TEXT.h1, "text-center")}>
        Getting started
        <br />
        with <span className="text-buzz-coral">Buzz</span>.
      </h2>
      <p className={cn(TEXT.body, "mt-3 text-center text-buzz-inkMuted")}>
        Three steps from idea to activated event.
      </p>
      <div className={cn("mt-14 grid md:grid-cols-3", GAP.section)}>
        {STEPS.map((step, i) => (
          <div key={step.title}>
            <div className={cn("rounded-buzzModal px-4 py-8", step.wash)}>
              <PhoneBezel>
                <PhoneInner kind={step.inner} />
              </PhoneBezel>
            </div>
            <h3 className={cn(TEXT.h3, "mt-6")}>
              <span className="text-buzz-inkFaint">{i + 1} </span>
              {step.title}
            </h3>
            <p
              className={cn(
                TEXT.body,
                "mt-2 leading-relaxed text-buzz-inkMuted",
              )}
            >
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default InspoGettingStarted;
