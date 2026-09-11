/**
 * Hero video block: public mode emphasizes Join Us scroll.
 */
import { siteIdentity } from "../../data/siteIdentity";
import { scrollToHomeJoin } from "../../utils/scrollHomeJoin";
import { Button } from "../forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function HomeHero() {
  const publicUrl = process.env.PUBLIC_URL ?? "";

  return (
    <section className="relative flex h-[520px] items-center overflow-hidden bg-buzz-dark md:h-[700px]">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-0 h-full w-full object-cover opacity-60"
      >
        <source src={`${publicUrl}/hero.mp4`} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-8 text-center md:text-left">
        <h1 className={cn(TEXT.display, "mb-2 max-w-3xl leading-tight text-buzz-paper md:text-6xl")}>
          Campus marketing, powered by student communities.
        </h1>
        <h2 className="mb-8 max-w-2xl text-xl font-medium text-buzz-paper/90 md:text-2xl">
          BUZZ connects brands with student organizations to execute large-scale
          campus activations nationwide.
        </h2>
        <div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 md:justify-start">
          <Button type="button" size="hero" onClick={scrollToHomeJoin}>
            Join Us!
          </Button>
        </div>
        <div className="mt-8 inline-block px-4 py-1 text-sm font-medium text-buzz-paper/80">
          {siteIdentity.content.heroSpotlightLine}
        </div>
      </div>
    </section>
  );
}
