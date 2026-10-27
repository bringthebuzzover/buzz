/**
 * /pulse2 — yellow and black marketing concept.
 * Copy and media are the live site's. /pulse is a separate page.
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { COLLEGES } from "../../data/colleges";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { siteIdentity } from "../../data/siteIdentity";
import PulseTwoCampusMap from "../../components/pulse2/PulseTwoCampusMap";
import { usePrefersReducedMotion } from "../../components/pulse2/usePrefersReducedMotion";
import { publicLogo } from "../../utils/publicLogo";
import entUpdate from "../../assets/ent-update-cornell.jpg";
import sorority from "../../assets/sorority.png";
import pathOrgs from "./media/path-orgs.jpg";
import pathBrands from "./media/path-brands.jpg";

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

const LOGO_COLLEGES = COLLEGES.filter(
  (college): college is (typeof COLLEGES)[number] & { logoSrc: string } => Boolean(college.logoSrc),
);

function LogoRow({ hidden }: { hidden?: boolean }) {
  return (
    <p className="pulse2-marquee__group" aria-hidden={hidden || undefined}>
      {LOGO_COLLEGES.map((college) => (
        <span key={college.name} className="pulse2-logo-item">
          <img className="pulse2-logo" src={college.logoSrc} alt={hidden ? "" : college.name} />
          <img className="pulse2-logo-bee" src={BEE} alt="" />
        </span>
      ))}
    </p>
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
  const yerba = FEATURED_COLLABS[0];
  const update = FEATURED_COLLABS[1];

  const drops = [
    {
      brand: "Yerba Madre",
      line: yerba.subtitle,
      image: sorority,
      alt: yerba.title,
    },
    {
      brand: "UPDATE",
      line: update.subtitle,
      image: entUpdate,
      alt: update.title,
    },
    {
      brand: "Yerba Madre",
      line: content.heroSpotlightLine,
      image: pathBrands,
      alt: "Students holding drinks at a campus event",
    },
  ];

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
              <span>Campus</span>
            </span>
            <span className="pulse2-line" data-reveal="load">
              <span>marketing.</span>
            </span>
          </h1>
          <p className="pulse2-hero__sub pulse2-line" data-reveal="load">
            <span>powered by student communities.</span>
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
        <div className="pulse2-drops__head">
          <h2 id="pulse2-drops">Current drops</h2>
          <Link to="/">See all</Link>
        </div>
        <div className="pulse2-drops__row">
          {drops.map((drop) => (
            <article key={drop.alt} className="pulse2-drop">
              <Link className="pulse2-drop__link" to="/">
                <span className="pulse2-drop__media">
                  <img src={drop.image} alt={drop.alt} />
                </span>
                <span className="pulse2-drop__brand">{drop.brand}</span>
                <span className="pulse2-drop__line">{drop.line}</span>
                <span className="pulse2-drop__more">View drop</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="pulse2-band" data-theme="paper" aria-label="Two ways in">
        <div className="pulse2-paths">
          <article className="pulse2-path" id="students">
            <div className="pulse2-reveal">
              <img className="pulse2-reveal__media" src={pathOrgs} alt="Students at a campus gathering" />
            </div>
            <h2>Apply with your campus .edu.</h2>
            <p>Connect Instagram after Buzz review.</p>
            <Link to="/for-orgs">See how organizations join</Link>
          </article>
          <article className="pulse2-path" id="brands">
            <div className="pulse2-reveal">
              <img className="pulse2-reveal__media" src={pathBrands} alt="Students holding drinks at a campus event" />
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
