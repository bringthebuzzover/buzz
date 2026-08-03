/**
 * Hero video block: public mode emphasizes Join Us scroll.
 */
import { siteIdentity } from "../../data/siteIdentity";
import { scrollToHomeJoin } from "../../utils/scrollHomeJoin";

export default function HomeHero() {
  const publicUrl = process.env.PUBLIC_URL ?? "";

  return (
    <section className="relative flex h-[700px] items-center overflow-hidden bg-buzz-dark">
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
        <h1 className="mb-2 max-w-3xl text-4xl font-bold leading-tight text-buzz-paper md:text-6xl">
          Campus marketing, powered by student communities.
        </h1>
        <h2 className="mb-8 max-w-2xl text-xl font-medium text-buzz-paper/90 md:text-2xl">
          BUZZ connects brands with student organizations to execute large-scale
          campus activations nationwide.
        </h2>
        <div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 md:justify-start">
          <button
            type="button"
            onClick={scrollToHomeJoin}
            className="rounded-lg bg-buzz-coral px-8 py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
          >
            Join Us!
          </button>
        </div>
        <div className="mt-8 inline-block px-4 py-1 text-sm font-medium text-buzz-paper/80">
          {siteIdentity.content.heroSpotlightLine}
        </div>
      </div>
    </section>
  );
}
