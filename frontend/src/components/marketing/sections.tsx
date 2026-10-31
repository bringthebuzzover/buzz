/**
 * Shared Pulse Black bands for Home, For organizations, and For brands.
 * Sizes follow the pen: hero 900/844, statement 54/32, section padding 108/68.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { BeeMark } from "../ui/BrandMark";
import { LinkButton } from "../forms/controls";
import { focusRingClass } from "../../theme/controls";
import { siteIdentity } from "../../data/siteIdentity";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { cn } from "../../theme/cn";
import { footerLinkClass, SOCIAL_LINKS } from "../site/footerLinks";
import { useReducedMotion } from "./useReducedMotion";
import { publicAsset } from "../../utils/publicAsset";

export function MarketingHero({
  title,
  sub,
  media,
  primary,
  aside,
}: {
  title: string;
  sub: string;
  media: "video" | { src: string; alt: string };
  primary: { label: string; to?: string; onClick?: () => void };
  aside?: { kicker: string; line: string };
}) {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduce && !video.paused) video.pause();
    if (!reduce && video.readyState >= 2) void video.play().catch(() => {});
  }, [reduce]);
  return (
    <section
      data-nav-surface="ink"
      className="marketing-hero relative h-[844px] overflow-hidden bg-page text-primary md:h-[900px]"
    >
      {media === "video" ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={!reduce}
          muted
          loop
          playsInline
        >
          <source src={publicAsset("hero.mp4")} type='video/mp4; codecs="hvc1"' />
          <source src={publicAsset("hero-h264.mp4")} type="video/mp4" />
        </video>
      ) : (
        <img
          src={media.src}
          alt={media.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-page via-page/35 to-page/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-page/70 via-transparent to-transparent" />
      <div className="marketing-hero-shade absolute inset-0 bg-page/60 opacity-0" />
      <BeeMark className="marketing-hero-bee absolute right-12 top-[198px] hidden h-[42px] w-[42px] md:block" />
      <div className="absolute inset-x-0 bottom-24 px-4 md:bottom-28 md:px-12">
        <h1 className="max-w-3xl whitespace-pre-line text-[36px] font-medium leading-none tracking-tight md:text-buzzTitle">
          {title.split("\n").map((line) => (
            <span key={line} className="block overflow-hidden">
              <span data-reveal-line className="block">
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p
          data-reveal-line
          className="mt-4 max-w-sm text-base leading-relaxed text-primary"
        >
          {sub}
        </p>
        {/* Pen hero Join instance is 44px. The default yellow pill is 40. */}
        <div className="marketing-hero-actions mt-6 flex items-center gap-6">
          {primary.to ? (
            <LinkButton to={primary.to} className="h-11 px-5">
              {primary.label}
            </LinkButton>
          ) : (
            <button
              type="button"
              onClick={primary.onClick}
              className={cn(
                "inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm text-on-accent",
                focusRingClass,
              )}
            >
              {primary.label}
            </button>
          )}
          <a
            href="#how-it-works"
            className={cn(
              "marketing-how-link text-sm text-primary",
              focusRingClass,
            )}
          >
            How it works{" "}
            <span className="inline-block" aria-hidden>
              →
            </span>
          </a>
        </div>
      </div>
      {aside ? (
        <div className="marketing-hero-actions absolute bottom-28 right-12 hidden w-64 text-right md:block">
          <p className="text-sm text-primary/80">{aside.kicker}</p>
          <p className="text-sm text-primary">{aside.line}</p>
        </div>
      ) : null}
    </section>
  );
}

export function Statement({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <section
      data-reveal-group
      data-nav-surface="paper"
      className="bg-[#f0f0f0] px-4 py-[68px] text-center md:py-[108px]"
    >
      <p
        data-reveal-line
        className="mx-auto max-w-4xl text-[32px] font-medium leading-none tracking-tight text-on-accent md:text-buzzStatement"
      >
        {line1}
      </p>
      <p
        data-reveal-line
        className="mx-auto mt-1 max-w-4xl text-[32px] font-medium leading-none tracking-tight text-on-accent/55 md:text-buzzStatement"
      >
        {line2}
      </p>
    </section>
  );
}

export function StackCards() {
  const reduce = useReducedMotion();
  return (
    <div data-nav-surface="ink">
      {FEATURED_COLLABS.map((collab, index) => (
        <article
          key={collab.id}
          className={cn(
            "marketing-stack relative bg-page flex h-[100svh] min-h-[560px] items-end overflow-hidden md:items-center",
            !reduce && "md:sticky md:top-0",
          )}
        >
          <img
            src={collab.image}
            alt={collab.title}
            className="marketing-stack-media absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-page/80 via-page/20 to-page/30" />
          <div className="marketing-stack-copy relative flex w-full items-center justify-between gap-6 px-4 pb-12 md:grid md:grid-cols-[1fr_2fr_1fr] md:px-12 md:pb-0">
            <p className="hidden max-w-xs text-sm text-primary md:block">
              {collab.subtitle}
            </p>
            <h2 className="whitespace-pre-line text-center text-[32px] font-medium leading-none text-primary md:text-buzzStatement">
              {collab.title.replace(" x ", "\nx ")}
            </h2>
            <p className="hidden max-w-xs text-right text-sm text-primary md:block">
              {index === 1 ? "Cornell University" : collab.subtitle}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CurrentDrops() {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const collab = FEATURED_COLLABS[index] ?? FEATURED_COLLABS[0];
  return (
    <section
      data-nav-surface="paper"
      className="bg-[#f0f0f0] px-4 py-[68px] text-on-accent md:px-12 md:py-[108px]"
    >
      <div className="mx-auto w-full">
        <div className="flex items-end justify-between">
          <h2 className="text-[36px] font-medium leading-none tracking-tight md:text-buzzTitle">
            Current drops
          </h2>
          <div className="flex gap-2">
            <CarouselButton
              label="Previous drop"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              ←
            </CarouselButton>
            <CarouselButton
              label="Next drop"
              disabled={index >= FEATURED_COLLABS.length - 1}
              onClick={() =>
                setIndex((value) =>
                  Math.min(FEATURED_COLLABS.length - 1, value + 1),
                )
              }
            >
              →
            </CarouselButton>
          </div>
        </div>
        {/* Lab scroller: cards fill 80% of the track with a 16px gap. */}
        <div className="mt-7 [container-type:inline-size]">
          <div className="overflow-hidden">
            <div
              className="flex gap-4 transition-transform duration-500 motion-reduce:transition-none"
              style={{
                transform: `translateX(calc(${-index} * (80cqw + 1rem)))`,
              }}
            >
              {FEATURED_COLLABS.map((item) => (
                <div key={item.id} className="w-[80cqw] shrink-0">
                  <div className="relative aspect-video overflow-hidden rounded-buzzBoard">
                    <img
                      src={item.image}
                      alt={item.title}
                      onLoad={() =>
                        setLoaded((value) => ({ ...value, [item.id]: true }))
                      }
                      className="h-full w-full object-cover"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-0 h-[30%] w-full bg-gradient-to-b from-black/45 to-transparent"
                    />
                    <p
                      className={cn(
                        "absolute left-5 top-5 text-[28px] font-medium text-white transition-opacity duration-200 motion-reduce:transition-none md:text-[32px]",
                        loaded[item.id] ? "opacity-100" : "opacity-0",
                      )}
                    >
                      {item.brand ?? item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex w-[80cqw] items-center justify-between gap-4">
            <p className="text-base">{collab.subtitle}</p>
            <span className="inline-flex h-9 shrink-0 items-center rounded-full bg-page px-3.5 text-xs text-primary">
              View drop
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CarouselButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-on-accent text-on-accent",
        disabled && "opacity-30",
        focusRingClass,
      )}
    >
      {children}
    </button>
  );
}

type Half = {
  kicker: string;
  title: string;
  support: string;
  action: { label: string; to: string };
  quiet?: { label: string; to: string };
};

export function JoinSplit({ left, right }: { left: Half; right: Half }) {
  return (
    <section data-nav-surface="paper" className="grid bg-[#f0f0f0] text-on-accent md:grid-cols-2">
      <HalfBlock {...left} />
      <HalfBlock {...right} divided />
    </section>
  );
}

function HalfBlock({
  kicker,
  title,
  support,
  action,
  quiet,
  divided,
}: Half & { divided?: boolean }) {
  return (
    <div
      className={cn(
        "marketing-join group flex min-h-[420px] flex-col transition-colors duration-300 hover:bg-page hover:text-primary focus-within:bg-page focus-within:text-primary motion-reduce:transition-none px-8 py-16 md:min-h-[560px] md:px-16 md:pb-[72px] md:pt-24",
        divided && "border-t border-on-accent/15 md:border-l md:border-t-0",
      )}
    >
      <p className="text-xs">{kicker}</p>
      <h2 className="mt-7 whitespace-pre-line text-[32px] font-medium leading-none md:text-buzzStatement">
        {title}
      </h2>
      <p className="mt-5 max-w-sm text-base leading-relaxed opacity-[0.65]">
        {support}
      </p>
      <div className="mt-auto flex flex-col items-start gap-4 pt-10 md:flex-row md:items-center md:justify-between">
        <LinkButton
          to={action.to}
          variant="secondary"
          className="h-11 gap-2 border-on-accent/20 bg-page px-4 text-primary group-hover:bg-accent group-hover:text-on-accent group-focus-within:bg-accent group-focus-within:text-on-accent motion-reduce:transition-none"
        >
          {action.label}
          <ChevronRight
            size={16}
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-1.5 group-focus-within:translate-x-1.5 motion-reduce:transform-none motion-reduce:transition-none"
          />
        </LinkButton>
        {quiet ? (
          <Link
            to={quiet.to}
            className={cn("text-sm text-inherit opacity-70", focusRingClass)}
          >
            {quiet.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section
      data-nav-surface="ink"
      className="bg-page px-4 py-[68px] text-primary md:px-12 md:py-[108px]"
    >
      <div className="mx-auto grid max-w-[1152px] gap-8 md:grid-cols-[373px_1fr] md:gap-6">
        <h2 className="text-[36px] font-medium leading-none tracking-tight md:text-buzzTitle">
          Questions
        </h2>
        <div>
          {items.map((item, index) => (
            <details
              key={item.q}
              open={index === 0}
              className="group border-b border-line py-4"
            >
              <summary
                className={cn(
                  "flex cursor-pointer list-none items-center justify-between gap-4 text-base",
                  focusRingClass,
                )}
              >
                {item.q}
                <span
                  className="text-muted transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function NumberedCards({
  kicker,
  support,
  cards,
}: {
  kicker: string;
  support: string;
  cards: {
    n: string;
    title: string;
    body: string;
    image?: string;
    alt?: string;
    mark?: boolean;
  }[];
}) {
  return (
    <section
      data-nav-surface="ink"
      className="bg-page px-4 py-[68px] text-primary md:px-12 md:py-[108px]"
    >
      <div className="mx-auto max-w-[1152px]">
        <h2 className="text-center text-[28px] font-medium leading-none md:text-buzzH2">{kicker}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-muted">{support}</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <article key={card.n}>
              <div className="relative mb-4 aspect-[368/345] overflow-hidden rounded-buzzBoard">
                {card.mark ? (
                  <div className="flex h-full items-center justify-center bg-accent">
                    <BeeMark className="h-28 w-28" />
                  </div>
                ) : (
                  <img src={card.image} alt={card.alt ?? ""} className="h-full w-full object-cover" />
                )}
                <span
                  className={cn(
                    "absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                    card.mark ? "bg-page text-accent" : "bg-accent text-on-accent",
                  )}
                >
                  {card.n}
                </span>
              </div>
              <h3 className="text-xl font-medium">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GoalChips() {
  const goals = [
    "Run a campus activation",
    "Get product to student organizations",
    "Grow Instagram engagement",
    "Reach more campuses",
  ];
  return (
    <section
      data-nav-surface="ink"
      data-reveal-group
      className="bg-page px-4 py-[126px] text-center text-primary md:px-12"
    >
      <h2
        data-reveal-line
        className="mx-auto max-w-xl whitespace-pre-line text-[32px] font-medium leading-none md:text-buzzStatement"
      >
        {"What are you hoping\nto do on BUZZ?"}
      </h2>
      <p className="mt-4 text-base text-muted">Tell us in your application.</p>
      <div className="mx-auto mt-12 flex max-w-3xl flex-wrap justify-center gap-3">
        {goals.map((goal) => (
          <Link
            key={goal}
            to="/brand/apply"
            className={cn(
              "inline-flex h-11 items-center rounded-full border border-primary px-6 text-sm text-primary transition-colors duration-300 hover:bg-primary hover:text-on-accent focus-visible:bg-primary focus-visible:text-on-accent motion-reduce:transition-none",
              focusRingClass,
            )}
          >
            {goal}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function MarketingFooter({
  brandOnly = false,
}: {
  brandOnly?: boolean;
}) {
  const { contact } = siteIdentity;
  return (
    <footer
      id="home-join"
      role="contentinfo"
      data-nav-surface="ink"
      className="flex min-h-[844px] flex-col bg-page px-4 pb-28 pt-24 text-primary md:min-h-[900px] md:px-12 md:pb-16 md:pt-[135px]"
    >
      <div
        data-reveal-group
        className="marketing-footer-inner flex flex-1 flex-col"
      >
        <h2
          data-reveal-line
          className="text-[48px] font-medium leading-none tracking-tight md:text-buzzDisplay"
        >
          {brandOnly ? "Request a campaign" : "Want to join?"}
        </h2>
        {brandOnly ? (
          <p className="mt-5 text-base text-muted">
            You request a call. BUZZ builds and publishes the drop.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {brandOnly ? null : (
            <Link
              to="/org/apply"
              className={cn(
                "inline-flex h-11 items-center rounded-full border border-primary px-5 text-sm text-primary",
                focusRingClass,
              )}
            >
              Join as a student organization
            </Link>
          )}
          <Link
            to="/brand/apply"
            className={cn(
              brandOnly
                ? "inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm text-on-accent"
                : "text-base text-primary",
              focusRingClass,
            )}
          >
            Apply as a brand
          </Link>
        </div>
        <a
          href={`mailto:${contact.email}`}
          className={cn(
            "mt-8 text-[20px] font-medium leading-none md:text-buzzStatement",
            focusRingClass,
          )}
        >
          {contact.email}
        </a>
        <div className="mt-auto grid grid-cols-2 gap-8 pt-16 md:grid-cols-4">
          <FooterCol
            title="Organizations"
            links={[
              ["/for-orgs", "How it works"],
              ["/org/apply", "Apply"],
              ["/login", "Login"],
            ]}
          />
          <FooterCol
            title="Brands"
            links={[
              ["/for-brands", "How it works"],
              ["/brand/apply", "Apply"],
              ["/brand/login", "Login"],
            ]}
          />
          <div>
            <h3 className="mb-3 text-sm font-medium">Social</h3>
            <ul className="space-y-2">
              {SOCIAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className={footerLinkClass}>
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${contact.email}`} className={footerLinkClass}>
                  Email
                </a>
              </li>
            </ul>
          </div>
          <FooterCol
            title="Legal"
            links={[
              ["/privacy", "Privacy"],
              ["/terms", "Terms"],
              ["/data-deletion", "Data deletion"],
            ]}
          />
        </div>
        <div className="mt-10 flex flex-col items-center gap-4 text-center text-xs text-muted md:flex-row md:justify-between md:text-left">
          <BeeMark className="h-7 w-7" />
          <p>
            Connecting brands with campus communities for authentic college
            marketing, at scale.
          </p>
          <p>2026</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className={footerLinkClass}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
