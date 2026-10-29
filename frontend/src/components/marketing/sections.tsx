/**
 * Shared Pulse Black bands for Home, For organizations, and For brands.
 * Sizes follow the pen: hero 900/844, statement 54/32, section padding 108/68.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { BeeMark } from "../ui/BrandMark";
import { LinkButton } from "../forms/controls";
import { focusRingClass } from "../../theme/controls";
import { siteIdentity } from "../../data/siteIdentity";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { cn } from "../../theme/cn";
import { useReducedMotion } from "./useReducedMotion";

const publicUrl = process.env.PUBLIC_URL ?? "";

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
  return (
    <section
      data-nav-surface="ink"
      className="relative h-[844px] overflow-hidden bg-page text-primary md:h-[900px]"
    >
      {media === "video" ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={!reduce}
          muted
          loop
          playsInline
        >
          <source src={`${publicUrl}/hero.mp4`} type='video/mp4; codecs="hvc1"' />
          <source src={`${publicUrl}/hero-h264.mp4`} type="video/mp4" />
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
      <BeeMark className="absolute right-12 top-[198px] hidden h-[42px] w-[42px] motion-safe:animate-buzz-float md:block" />
      <div className="absolute inset-x-0 bottom-24 px-4 md:bottom-28 md:px-12">
        <h1 className="max-w-3xl whitespace-pre-line text-[36px] font-medium leading-none tracking-tight md:text-buzzTitle">
          {title}
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-primary">{sub}</p>
        <div className="mt-6 flex items-center gap-6">
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
            className={cn("text-sm text-primary", focusRingClass)}
          >
            How it works →
          </a>
        </div>
      </div>
      {aside ? (
        <div className="absolute bottom-28 right-12 hidden w-64 text-right md:block">
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
      data-nav-surface="paper"
      className="bg-[#f0f0f0] px-4 py-[68px] text-center md:py-[108px]"
    >
      <p className="mx-auto max-w-4xl text-[32px] font-medium leading-none tracking-tight text-on-accent md:text-buzzStatement">
        {line1}
      </p>
      <p className="mx-auto mt-1 max-w-4xl text-[32px] font-medium leading-none tracking-tight text-on-accent/55 md:text-buzzStatement">
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
            "relative flex h-[844px] items-end overflow-hidden md:h-[900px]",
            !reduce && "md:sticky md:top-0",
          )}
        >
          <img
            src={collab.image}
            alt={collab.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-page/80 via-page/20 to-page/30" />
          <div className="relative flex w-full items-end justify-between gap-6 px-4 pb-16 md:px-12">
            <p className="hidden max-w-xs text-sm text-primary md:block">{collab.subtitle}</p>
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
  const collab = FEATURED_COLLABS[index] ?? FEATURED_COLLABS[0];
  return (
    <section
      data-nav-surface="paper"
      className="bg-[#f0f0f0] px-4 py-[68px] text-on-accent md:px-12 md:py-[108px]"
    >
      <div className="mx-auto max-w-[1344px]">
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
                setIndex((value) => Math.min(FEATURED_COLLABS.length - 1, value + 1))
              }
            >
              →
            </CarouselButton>
          </div>
        </div>
        <div className="mt-7 overflow-hidden">
          <div
            className="flex transition-transform duration-500 motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {FEATURED_COLLABS.map((item) => (
              <div key={item.id} className="w-full shrink-0 pr-0 md:pr-8">
                <div className="relative h-[420px] overflow-hidden rounded-buzzBoard md:h-[605px]">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-page/85 via-transparent to-page/20" />
                  <p className="absolute bottom-8 left-8 text-2xl font-medium text-primary md:text-buzzH2">
                    {item.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-base">{collab.subtitle}</p>
          <span className="inline-flex h-9 items-center rounded-full border border-on-accent/20 px-3.5 text-xs">
            View drop
          </span>
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

function HalfBlock({ kicker, title, support, action, quiet, divided }: Half & { divided?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[420px] flex-col px-8 py-16 md:min-h-[560px] md:px-16 md:pb-[72px] md:pt-24",
        divided && "border-t border-on-accent/15 md:border-l md:border-t-0",
      )}
    >
      <p className="text-xs">{kicker}</p>
      <h2 className="mt-7 whitespace-pre-line text-[32px] font-medium leading-none md:text-buzzStatement">
        {title}
      </h2>
      <p className="mt-5 max-w-sm text-base leading-relaxed text-on-accent/65">{support}</p>
      <div className="mt-auto flex items-center justify-between gap-4 pt-10">
        <LinkButton
          to={action.to}
          variant="secondary"
          className="h-11 border-on-accent/20 bg-page px-4 text-primary"
        >
          {action.label}
        </LinkButton>
        {quiet ? (
          <Link to={quiet.to} className={cn("text-sm text-on-accent/70", focusRingClass)}>
            {quiet.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function FaqList({
  items,
}: {
  items: { q: string; a: string }[];
}) {
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
                <span className="text-muted group-open:rotate-45" aria-hidden>
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
  cards: { n: string; title: string; body: string; image?: string; alt?: string; mark?: boolean }[];
}) {
  return (
    <section
      data-nav-surface="ink"
      className="bg-page px-4 pb-[68px] text-primary md:px-12 md:pb-[108px]"
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
      className="bg-page px-4 py-[126px] text-center text-primary md:px-12"
    >
      <h2 className="mx-auto max-w-xl whitespace-pre-line text-[32px] font-medium leading-none md:text-buzzStatement">
        {"What are you hoping\nto do on BUZZ?"}
      </h2>
      <p className="mt-4 text-base text-muted">Tell us in your application.</p>
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        {goals.map((goal) => (
          <span
            key={goal}
            className="inline-flex h-11 items-center rounded-full border border-primary px-6 text-sm text-primary"
          >
            {goal}
          </span>
        ))}
      </div>
    </section>
  );
}

const footerLink = cn("text-sm text-muted hover:text-primary", focusRingClass);

export function MarketingFooter() {
  const { contact, social } = siteIdentity;
  return (
    <footer
      id="home-join"
      role="contentinfo"
      data-nav-surface="ink"
      className="flex min-h-[844px] flex-col bg-page px-4 pb-28 pt-24 text-primary md:min-h-[900px] md:px-12 md:pb-16 md:pt-[135px]"
    >
      <h2 className="text-[48px] font-medium leading-none tracking-tight md:text-buzzDisplay">
        Want to join?
      </h2>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          to="/org/apply"
          className={cn(
            "inline-flex h-11 items-center rounded-full border border-primary px-5 text-sm text-primary",
            focusRingClass,
          )}
        >
          Join as a student organization
        </Link>
        <Link to="/brand/apply" className={cn("text-base text-primary", focusRingClass)}>
          Apply as a brand
        </Link>
      </div>
      <a
        href={`mailto:${contact.email}`}
        className={cn(
          "mt-8 text-[32px] font-medium leading-none md:text-buzzStatement",
          focusRingClass,
        )}
      >
        {contact.email}
      </a>
      <div className="mt-auto grid gap-8 pt-16 sm:grid-cols-2 md:grid-cols-4">
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
            <li>
              <a href={social.instagram.profileUrl} className={footerLink}>
                Instagram
              </a>
            </li>
            <li>
              <a href={social.linkedin.companyUrl} className={footerLink}>
                LinkedIn
              </a>
            </li>
            <li>
              <a href={`mailto:${contact.email}`} className={footerLink}>
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
      <div className="mt-10 flex items-center justify-between gap-4 text-xs text-muted">
        <BeeMark className="h-7 w-7" />
        <p>Connecting brands with campus communities for authentic college marketing, at scale.</p>
        <p>2026</p>
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
            <Link to={to} className={footerLink}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusHero({
  kicker,
  title,
  support,
}: {
  kicker?: string;
  title: string;
  support?: string;
}) {
  return (
    <div className="flex min-h-[640px] flex-col items-center justify-center px-4 py-16 text-center text-primary">
      {kicker ? (
        <h1 className="text-[48px] font-medium leading-none text-accent md:text-buzzDisplay">{kicker}</h1>
      ) : (
        <BeeMark className="mb-6 h-28 w-28 motion-safe:animate-buzz-float" />
      )}
      {kicker ? (
        <p className="mt-2 max-w-xl text-xl font-medium leading-tight">{title}</p>
      ) : (
        <h1 className="max-w-xl text-[36px] font-medium leading-tight md:text-buzzTitle">{title}</h1>
      )}
      {support ? <p className="mt-4 max-w-md text-base text-muted">{support}</p> : null}
      <div className="mt-6 flex items-center gap-3">
        <LinkButton to="/">Home</LinkButton>
        <LinkButton to="/login" variant="outline" className="h-10">
          Log in
        </LinkButton>
      </div>
      {kicker ? <BeeMark className="mt-10 h-16 w-16 opacity-90" /> : null}
    </div>
  );
}
