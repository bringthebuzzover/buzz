/**
 * Dark full-width hero: looping `public/hero.mp4`, headline, dual CTAs to `/register` and `/campaigns`,
 * and spotlight line from `siteIdentity.content.heroSpotlightLine`.
 */
import { useNavigate } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";

export default function HomeHero() {
  const navigate = useNavigate();
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
        <h1 className="mb-2 text-5xl font-bold leading-tight text-buzz-paper md:text-7xl">
          BRING YOUR BRAND
          <br />
          TO OUR CAMPUS
        </h1>
        <h2 className="mb-6 text-2xl font-bold italic text-buzz-coral drop-shadow-buzz">
          BRING THE BUZZ OVER
        </h2>

        <p className="mx-auto mb-8 max-w-md text-lg font-medium text-buzz-paper md:mx-0">
          Connecting brands with campus communities for authentic college
          marketing, at scale.
        </p>
        <div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 md:justify-start">
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="rounded-lg bg-buzz-coral px-8 py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
          >
            Join Buzz!
          </button>
          <button
            type="button"
            onClick={() => navigate("/campaigns")}
            className="rounded-lg border border-buzz-paper/50 bg-buzz-overlay/30 px-8 py-3 font-bold text-buzz-paper shadow-sm backdrop-blur-sm transition hover:bg-buzz-overlay/50"
          >
            Browse Campaigns
          </button>
        </div>
        <div className="mt-8 inline-block px-4 py-1 text-sm font-medium text-buzz-paper/80">
          {siteIdentity.content.heroSpotlightLine}
        </div>
      </div>
    </section>
  );
}
