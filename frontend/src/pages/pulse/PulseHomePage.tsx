/**
 * /pulse — yellow and black marketing concept.
 * Copy is shortened from the live home, /for-orgs, and /for-brands pages.
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { COLLEGES } from "../../data/colleges";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { siteIdentity } from "../../data/siteIdentity";
import { usePrefersReducedMotion } from "../../components/pulse/usePrefersReducedMotion";
import pathOrgs from "./media/path-orgs.jpg";
import pathBrands from "./media/path-brands.jpg";

const STEPS = [
  {
    index: 0,
    side: "left",
    kicker: "Apply",
    title: "Campus .edu email",
    caption: "Apply with your campus .edu email.",
  },
  {
    index: 1,
    side: "right",
    kicker: "Instagram",
    title: "Business or Creator",
    detail: "@cornellouting",
    caption: "Use the Business or Creator account.",
  },
  {
    index: 2,
    side: "left",
    kicker: "Approved",
    title: "Connect Instagram",
    caption: "Connect Instagram after approval.",
  },
  {
    index: 3,
    side: "right",
    kicker: "Drop Feed",
    title: "Campus Kickoff 2026",
    detail: "Ithaca, NY · Open",
    caption: "Apply when a drop is Open.",
  },
] as const;

function Names({ hidden }: { hidden?: boolean }) {
  return (
    <p className="pulse-marquee__group" aria-hidden={hidden || undefined}>
      {COLLEGES.map((college) => (
        <span key={college.name}>{college.name}</span>
      ))}
    </p>
  );
}

export default function PulseHomePage() {
  const reduced = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const publicUrl = process.env.PUBLIC_URL ?? "";
  const { content } = siteIdentity;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !reduced) return undefined;
    try {
      video.pause();
    } catch {
      // jsdom's pause() is a throwing stub.
    }
    return undefined;
  }, [reduced]);

  const leftSteps = STEPS.filter((step) => step.side === "left");
  const rightSteps = STEPS.filter((step) => step.side === "right");

  return (
    <>
      <section className="pulse-hero" data-theme="ink" data-surface="dark" aria-label="Introduction">
        <video
          ref={videoRef}
          className="pulse-hero__video"
          autoPlay={!reduced}
          muted
          loop
          playsInline
          aria-hidden="true"
        >
          <source src={`${publicUrl}/hero.mp4`} type='video/mp4; codecs="hvc1"' />
          <source src={`${publicUrl}/hero-h264.mp4`} type="video/mp4" />
        </video>
        <div className="pulse-hero__scrim" aria-hidden="true" />
        <div className="pulse-hero__shade" aria-hidden="true" />
        <div className="pulse-hero__center">
          <h1 className="pulse-display">
            <span className="pulse-line" data-reveal="load">
              <span>Campus</span>
            </span>
            <span className="pulse-line" data-reveal="load">
              <span>marketing.</span>
            </span>
          </h1>
          <div className="pulse-hero__actions">
            <Link className="pulse-ghost" to="/brand/apply">
              Apply as a brand
            </Link>
          </div>
        </div>
        <p className="pulse-hero__sub pulse-line" data-reveal="load">
          <span>powered by student communities.</span>
        </p>
      </section>

      <section className="pulse-band" data-theme="paper" aria-labelledby="pulse-statement">
        <div className="pulse-measure" data-reveal-group>
          <h2 id="pulse-statement" className="pulse-statement">
            <span className="pulse-line">
              <span>Our platform makes it easy</span>
            </span>
            <span className="pulse-line pulse-line--quiet">
              <span>for brands to connect with student organizations.</span>
            </span>
          </h2>
        </div>
      </section>

      <section className="pulse-band pulse-band--tight" data-theme="paper" aria-label="Campuses">
        <p className="pulse-support">
          Vetted student organizations powering authentic campus marketing nationwide.
        </p>
        <div className="pulse-marquee">
          <div className="pulse-marquee__track">
            <Names />
            <Names hidden />
          </div>
        </div>
      </section>

      <section className="pulse-how" id="how" data-theme="paper" aria-labelledby="pulse-how-title">
        <h2 id="pulse-how-title" className="pulse-sr">
          How it works
        </h2>
        <div className="pulse-how__pin">
          <div className="pulse-how__copy">
            {leftSteps.map((step) => (
              <p key={step.caption} className="pulse-step" data-side="left" data-index={step.index}>
                {step.caption}
              </p>
            ))}
          </div>
          <div className="pulse-phone" aria-hidden="true">
            {STEPS.map((step) => (
              <div key={step.caption} className="pulse-phone__screen" data-index={step.index}>
                <p className="pulse-kicker">{step.kicker}</p>
                <p className="pulse-phone__title">{step.title}</p>
                {"detail" in step ? <p className="pulse-phone__detail">{step.detail}</p> : null}
              </div>
            ))}
          </div>
          <div className="pulse-how__copy pulse-how__copy--right">
            {rightSteps.map((step) => (
              <p key={step.caption} className="pulse-step" data-side="right" data-index={step.index}>
                {step.caption}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="pulse-stack" data-theme="ink" data-surface="dark" aria-label="Featured collaborations">
        {FEATURED_COLLABS.map((collab, index) => (
          <article key={collab.id} className="pulse-card">
            <div className="pulse-card__media">
              <img src={collab.image} alt="" />
              <div className="pulse-card__shade" />
            </div>
            <div className="pulse-card__copy">
              <p className="pulse-card__tag">{collab.subtitle}</p>
              <h2>{collab.title}</h2>
              <p className="pulse-card__tag pulse-card__tag--end">
                {index === 0 ? content.heroSpotlightLine : "Cornell University"}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="pulse-band" data-theme="paper" aria-label="Two ways in">
        <div className="pulse-paths">
          <article className="pulse-path" id="students">
            <div className="pulse-reveal">
              <img className="pulse-reveal__media" src={pathOrgs} alt="Students at a campus gathering" />
            </div>
            <h2>Apply with your campus .edu.</h2>
            <p>Connect Instagram after Buzz review.</p>
            <Link to="/for-orgs">See how organizations join</Link>
          </article>
          <article className="pulse-path" id="brands">
            <div className="pulse-reveal">
              <img className="pulse-reveal__media" src={pathBrands} alt="Students holding drinks at a campus event" />
            </div>
            <h2>Request a campaign.</h2>
            <p>Buzz drafts and publishes it.</p>
            <Link to="/for-brands">See how brands run a campaign</Link>
          </article>
        </div>
      </section>
    </>
  );
}
