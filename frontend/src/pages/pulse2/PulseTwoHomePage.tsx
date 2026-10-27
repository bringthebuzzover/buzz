/**
 * /pulse2 — yellow and black marketing concept.
 * Copy and media are the live site's. /pulse is a separate page.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { COLLEGES } from "../../data/colleges";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { siteIdentity } from "../../data/siteIdentity";
import PulseTwoCampusMap from "../../components/pulse2/PulseTwoCampusMap";
import { usePrefersReducedMotion } from "../../components/pulse2/usePrefersReducedMotion";
import { publicLogo } from "../../utils/publicLogo";
import type { CollegeMarqueeItem } from "../../types/campaign";

const BEE = publicLogo("bee.svg");

const STEPS = [
  {
    index: 0,
    side: "left",
    caption: "Apply with your campus .edu email.",
  },
  {
    index: 1,
    side: "right",
    caption: "Use the Business or Creator account.",
  },
  {
    index: 2,
    side: "left",
    caption: "Connect Instagram after approval.",
  },
  {
    index: 3,
    side: "right",
    caption: "Apply when a drop is Open.",
  },
] as const;

/** Local mark first, otherwise Clearbit by domain. icon.horse is the onError fallback. */
function logoSrcFor(item: CollegeMarqueeItem): string {
  return item.logoSrc ?? `https://logo.clearbit.com/${item.domain}`;
}

function LogoRow({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="pulse2-marquee__group" aria-hidden={hidden || undefined}>
      {COLLEGES.map((college) => (
        <li key={college.domain} className="pulse2-logo-item">
          <img
            className="pulse2-logo"
            src={logoSrcFor(college)}
            alt={hidden ? "" : college.name}
            onError={(event) => {
              const img = event.currentTarget;
              const fallback = `https://icon.horse/icon/${college.domain}`;
              if (img.src !== fallback) img.src = fallback;
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function brandName(title: string): string {
  const parts = title.split(" x ");
  return parts[parts.length - 1] || title;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={dir === "left" ? "M10 3 L5 8 L10 13" : "M6 3 L11 8 L6 13"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DropsCarousel() {
  const reduced = usePrefersReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; moved: boolean; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [index, setIndex] = useState(0);
  const count = FEATURED_COLLABS.length;

  const targetLeft = useCallback((el: HTMLDivElement, i: number) => {
    const slide = el.children[i] as HTMLElement | undefined;
    if (!slide) return 0;
    const slideLeft = slide.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    if (i >= count - 1) {
      return Math.max(0, slideLeft - (el.clientWidth - slide.getBoundingClientRect().width));
    }
    return slideLeft;
  }, [count]);

  const go = (next: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.max(0, Math.min(count - 1, next));
    el.scrollTo({ left: targetLeft(el, i), behavior: reduced ? "auto" : "smooth" });
    setIndex(i);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < count; i += 1) {
        const dist = Math.abs(el.scrollLeft - targetLeft(el, i));
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      setIndex(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [count, targetLeft]);

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    const state = drag.current;
    drag.current = null;
    if (!el || !state) return;
    el.style.scrollSnapType = "";
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    if (!state.active) return;
    suppressClick.current = true;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < count; i += 1) {
      const dist = Math.abs(el.scrollLeft - targetLeft(el, i));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    el.scrollTo({ left: targetLeft(el, best), behavior: reduced ? "auto" : "smooth" });
    setIndex(best);
  };

  const active = FEATURED_COLLABS[index] ?? FEATURED_COLLABS[0];

  return (
    <div className="pulse2-carousel">
      <div className="pulse2-carousel__head">
        <h2 id="pulse2-drops">Current drops</h2>
        <div className="pulse2-carousel__arrows">
          <button
            type="button"
            className="pulse2-carousel__arrow"
            aria-label="Previous drop"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            className="pulse2-carousel__arrow"
            aria-label="Next drop"
            disabled={index === count - 1}
            onClick={() => go(index + 1)}
          >
            <Chevron dir="right" />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="pulse2-carousel__scroller"
        role="region"
        aria-roledescription="carousel"
        aria-label="Current drops"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(index + 1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(index - 1);
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          const el = scrollerRef.current;
          if (!el) return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: el.scrollLeft,
            moved: false,
            active: false,
          };
        }}
        onPointerMove={(event) => {
          const el = scrollerRef.current;
          const state = drag.current;
          if (!el || !state || event.pointerType !== "mouse") return;
          const dx = event.clientX - state.x;
          const dy = event.clientY - state.y;
          if (!state.active) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dy) > Math.abs(dx)) {
              drag.current = null;
              return;
            }
            state.active = true;
            el.setPointerCapture(event.pointerId);
            el.style.scrollSnapType = "none";
          }
          state.moved = true;
          el.scrollLeft = state.left - dx;
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {FEATURED_COLLABS.map((collab, i) => (
          <article
            key={collab.id}
            className="pulse2-carousel__slide"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
          >
            <Link className="pulse2-carousel__frame" to="/">
              <img src={collab.image} alt="" />
              <span className="pulse2-carousel__brand">{brandName(collab.title)}</span>
            </Link>
          </article>
        ))}
      </div>
      <div className={`pulse2-carousel__meta${index === count - 1 ? " is-end" : ""}`}>
        <p>{active.subtitle}</p>
        <Link className="pulse2-carousel__view" to="/">
          View drop
        </Link>
      </div>
    </div>
  );
}

function ApplyScreen() {
  return (
    <div className="pulse2-app">
      <p className="pulse2-app__kicker">Apply</p>
      <p className="pulse2-app__label">Organization name</p>
      <p className="pulse2-app__field">Kappa Alpha Theta</p>
      <p className="pulse2-app__label">University</p>
      <p className="pulse2-app__field">Cornell</p>
      <p className="pulse2-app__label">School (.edu) email</p>
      <p className="pulse2-app__field pulse2-app__field--muted">you@university.edu</p>
      <p className="pulse2-app__btn">Submit application</p>
    </div>
  );
}

function InstagramScreen() {
  return (
    <div className="pulse2-app">
      <p className="pulse2-app__kicker">Instagram</p>
      <p className="pulse2-app__title">Business or Creator</p>
      <p className="pulse2-app__copy">
        Connect the organization&apos;s Instagram <strong>Business or Creator</strong> account —
        not a personal member profile.
      </p>
      <div className="pulse2-app__foot">
        <p className="pulse2-app__label">Instagram handle</p>
        <p className="pulse2-app__field pulse2-app__field--muted">yourorg</p>
      </div>
    </div>
  );
}

function ConnectScreen() {
  return (
    <div className="pulse2-app">
      <p className="pulse2-app__kicker">Approved</p>
      <p className="pulse2-app__title">Connect Instagram</p>
      <p className="pulse2-app__copy">
        First accept Buzz&apos;s Instagram Tester invite, then continue.
      </p>
      <p className="pulse2-app__btn pulse2-app__btn--row">
        <img src={siteIdentity.images.socialInstagramIcon} alt="" />
        Connect with Instagram
      </p>
    </div>
  );
}

function DropScreen() {
  const collab = FEATURED_COLLABS[0];
  const metrics = ["Posts", "Likes", "Comments", "Instagram Reach"];
  return (
    <div className="pulse2-app">
      <p className="pulse2-app__kicker">Drop Feed</p>
      <p className="pulse2-app__title">{collab.title}</p>
      <p className="pulse2-app__copy">{collab.subtitle}</p>
      <ul className="pulse2-app__status">
        <li>Upcoming</li>
        <li aria-current="true">Open</li>
        <li>Closed</li>
        <li>Full</li>
      </ul>
      <ul className="pulse2-app__metrics">
        {metrics.map((label) => (
          <li key={label}>
            <span>—</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCREENS = [ApplyScreen, InstagramScreen, ConnectScreen, DropScreen];

export default function PulseTwoHomePage() {
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
      <section className="pulse2-hero" data-theme="ink" data-surface="dark" aria-label="Introduction">
        <video
          ref={videoRef}
          className="pulse2-hero__video"
          autoPlay={!reduced}
          muted
          loop
          playsInline
          aria-hidden="true"
        >
          <source src={`${publicUrl}/hero.mp4`} type='video/mp4; codecs="hvc1"' />
          <source src={`${publicUrl}/hero-h264.mp4`} type="video/mp4" />
        </video>
        <div className="pulse2-hero__scrim" aria-hidden="true" />
        <div className="pulse2-hero__shade" aria-hidden="true" />
        <img className="pulse2-bee" src={BEE} alt="" />
        <div className="pulse2-hero__copy">
          <h1 className="pulse2-display">
            <span className="pulse2-line" data-reveal="load">
              <span>Campus marketing,</span>
            </span>
            <span className="pulse2-line" data-reveal="load">
              <span>powered by</span>
            </span>
            <span className="pulse2-line" data-reveal="load">
              <span>student communities.</span>
            </span>
          </h1>
          <p className="pulse2-hero__sub pulse2-line" data-reveal="load">
            <span>
              BUZZ connects brands with student organizations to execute large-scale campus
              activations nationwide.
            </span>
          </p>
          <div className="pulse2-hero__actions">
            <Link className="pulse2-pill" to="/org/apply">
              Join
            </Link>
            <a className="pulse2-textlink" href="#how">
              How it works
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <aside className="pulse2-hero__aside">
          <p className="pulse2-kicker">Collaboration</p>
          <p>{content.heroSpotlightLine}</p>
        </aside>
      </section>

      <section className="pulse2-band" data-theme="paper" aria-labelledby="pulse2-statement">
        <div className="pulse2-measure" data-reveal-group>
          <h2 id="pulse2-statement" className="pulse2-statement">
            <span className="pulse2-line">
              <span>Our platform makes it easy</span>
            </span>
            <span className="pulse2-line pulse2-line--quiet">
              <span>for brands to connect with student organizations.</span>
            </span>
          </h2>
        </div>
      </section>

      <section className="pulse2-band pulse2-network" data-theme="paper" aria-labelledby="pulse2-network">
        <div className="pulse2-network__head">
          <h2 id="pulse2-network">College network</h2>
          <p className="pulse2-support">
            Vetted student organizations powering authentic campus marketing nationwide.
          </p>
        </div>
        <PulseTwoCampusMap />
        <div className="pulse2-marquee">
          <div className="pulse2-marquee__track">
            <LogoRow />
            <LogoRow hidden />
          </div>
        </div>
      </section>

      <section className="pulse2-how" id="how" data-theme="paper" aria-labelledby="pulse2-how-title">
        <h2 id="pulse2-how-title" className="pulse2-sr">
          How it works
        </h2>
        <div className="pulse2-how__pin">
          <div className="pulse2-how__copy">
            {leftSteps.map((step) => (
              <p key={step.caption} className="pulse2-step" data-side="left" data-index={step.index}>
                {step.caption}
              </p>
            ))}
          </div>
          <div className="pulse2-phone" aria-hidden="true">
            {STEPS.map((step) => {
              const Screen = SCREENS[step.index];
              return (
                <div key={step.caption} className="pulse2-phone__screen" data-index={step.index}>
                  <Screen />
                </div>
              );
            })}
          </div>
          <div className="pulse2-how__copy pulse2-how__copy--right">
            {rightSteps.map((step) => (
              <p key={step.caption} className="pulse2-step" data-side="right" data-index={step.index}>
                {step.caption}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="pulse2-stack" data-theme="ink" data-surface="dark" aria-label="Featured collaborations">
        {FEATURED_COLLABS.map((collab, index) => (
          <article key={collab.id} className="pulse2-card">
            <div className="pulse2-card__media">
              <img src={collab.image} alt="" />
              <div className="pulse2-card__shade" />
            </div>
            <div className="pulse2-card__copy">
              <p className="pulse2-card__tag">{collab.subtitle}</p>
              <h2>{collab.title}</h2>
              <p className="pulse2-card__tag pulse2-card__tag--end">
                {index === 0 ? content.heroSpotlightLine : "Cornell University"}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="pulse2-band" id="drops" data-theme="paper" aria-labelledby="pulse2-drops">
        <DropsCarousel />
      </section>

      <section className="pulse2-join" data-theme="paper" aria-label="Join">
        <div className="pulse2-join__half" id="students">
          <Link className="pulse2-join__main" to="/org/apply">
            <span className="pulse2-join__kicker">For organizations</span>
            <span className="pulse2-join__title">
              Apply with your <span className="pulse2-join__nowrap">campus .edu.</span>
            </span>
            <span className="pulse2-join__support">You apply on the website first.</span>
            <span className="pulse2-join__pill">
              Apply as an organization
              <Chevron dir="right" />
            </span>
          </Link>
          <Link className="pulse2-join__quiet" to="/for-orgs">
            See how organizations join
          </Link>
        </div>
        <div className="pulse2-join__half" id="brands">
          <Link className="pulse2-join__main" to="/brand/apply">
            <span className="pulse2-join__kicker">For brands</span>
            <span className="pulse2-join__title">Request a campaign.</span>
            <span className="pulse2-join__support">
              You request a call. Buzz mints and publishes the drop.
            </span>
            <span className="pulse2-join__pill">
              Apply as a brand
              <Chevron dir="right" />
            </span>
          </Link>
          <Link className="pulse2-join__quiet" to="/for-brands">
            See how brands run a campaign
          </Link>
        </div>
      </section>
    </>
  );
}
