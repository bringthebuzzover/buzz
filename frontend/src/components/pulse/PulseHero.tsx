/**
 * Full-viewport hero. Same HEVC + H.264 sources as the live home hero.
 * The scrim stays dark on the left so the type holds over bright footage.
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export default function PulseHero() {
  const reduced = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const publicUrl = process.env.PUBLIC_URL ?? "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (reduced) {
      video.pause();
      return undefined;
    }
    try {
      const pending = video.play();
      if (pending && typeof pending.catch === "function") {
        pending.catch(() => undefined);
      }
    } catch {
      // jsdom's media element has no play(), and some browsers block autoplay.
    }
    return undefined;
  }, [reduced]);

  return (
    <section className="pulse-hero" aria-label="Intro">
      <video
        ref={videoRef}
        className="pulse-hero__video"
        autoPlay={!reduced}
        loop
        muted
        playsInline
        preload={reduced ? "metadata" : "auto"}
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src={`${publicUrl}/hero.mp4`} type='video/mp4; codecs="hvc1"' />
        <source src={`${publicUrl}/hero-h264.mp4`} type="video/mp4" />
      </video>
      <div className="pulse-hero__scrim" />
      <div className="pulse-wrap pulse-hero__content">
        <p className="pulse-kicker pulse-hero__kicker">{siteIdentity.brand.displayName}</p>
        <h1 className="pulse-display">
          <span className="pulse-hero__lead">
            Campus
            <br />
            marketing<span className="pulse-dot">.</span>
          </span>
          <span className="pulse-hero__tail">
            powered by
            <br />
            student communities.
          </span>
        </h1>
        <p className="pulse-hero__sub">
          BUZZ connects brands with student organizations to execute large-scale
          campus activations nationwide.
        </p>
        <div className="pulse-hero__actions">
          <Link className="pulse-btn pulse-btn--yellow" to="/org/apply">
            Join as Student Organization
          </Link>
          <Link className="pulse-btn pulse-btn--ghost" to="/brand/apply">
            Apply as Brand
          </Link>
        </div>
        <p className="pulse-hero__spot">{siteIdentity.content.heroSpotlightLine}</p>
      </div>
    </section>
  );
}
