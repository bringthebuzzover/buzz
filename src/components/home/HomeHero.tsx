/**
 * Hero video block: full CTAs in demo mode; public mode emphasizes waitlist scroll (no browse campaigns).
 */
import { useNavigate } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { useAccessGate } from "../../contexts/AccessGateContext";
import { scrollToHomeWaitlist } from "../../utils/scrollHomeWaitlist";

export default function HomeHero() {
  const navigate = useNavigate();
  const { isDemoActive, demoView, openPasscodeModal } = useAccessGate();
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
          {isDemoActive ? (
            <>
              {demoView === "brand" ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/brand/dashboard")}
                    className="rounded-lg bg-buzz-coral px-8 py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
                  >
                    See Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/brand/dashboard", {
                        state: { openPlanCampaign: true },
                      })
                    }
                    className="rounded-lg border border-buzz-paper/50 bg-buzz-overlay/30 px-8 py-3 font-bold text-buzz-paper shadow-sm backdrop-blur-sm transition hover:bg-buzz-overlay/50"
                  >
                    Plan your Campaign
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/org/campaigns")}
                    className="rounded-lg bg-buzz-coral px-8 py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
                  >
                    My Campaigns
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/org/drops")}
                    className="rounded-lg border border-buzz-paper/50 bg-buzz-overlay/30 px-8 py-3 font-bold text-buzz-paper shadow-sm backdrop-blur-sm transition hover:bg-buzz-overlay/50"
                  >
                    Browse Campaigns
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={scrollToHomeWaitlist}
                className="rounded-lg bg-buzz-coral px-8 py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
              >
                Join Waitlist!
              </button>
              <button
                type="button"
                onClick={openPasscodeModal}
                className="rounded-lg border border-buzz-paper/50 bg-buzz-overlay/30 px-8 py-3 font-bold text-buzz-paper shadow-sm backdrop-blur-sm transition hover:bg-buzz-overlay/50"
              >
                View Demo
              </button>
            </>
          )}
        </div>
        <div className="mt-8 inline-block px-4 py-1 text-sm font-medium text-buzz-paper/80">
          {siteIdentity.content.heroSpotlightLine}
        </div>
      </div>
    </section>
  );
}
