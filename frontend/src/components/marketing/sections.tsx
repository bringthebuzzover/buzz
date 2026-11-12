/**
 * Shared Pulse Black bands for Home, For organizations, and For brands.
 * Sizes follow the pen: hero 900/844, statement 54/32, section padding 108/68.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BeeMark } from "../ui/BrandMark";
import { Button, LinkButton } from "../forms/controls";
import { focusRingClass } from "../../theme/controls";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { cn } from "../../theme/cn";
import { useReducedMotion } from "./useReducedMotion";
import { publicAsset } from "../../utils/publicAsset";
import { usePublicDropCatalog } from "../../api/hooks/useDropHooks";
import { publicDropPath } from "../../utils/oauthNext";
import { StatePanel } from "../ui/StatePanel";
import { RemoteImage } from "../ui/RemoteImage";
import { DROP_CAROUSEL, GAP, SECTION_X, SECTION_Y } from "../../theme/tokens";

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
        <h1 className="max-w-3xl whitespace-pre-line text-[36px] font-medium leading-[1] tracking-tight md:text-buzzTitle md:leading-[1]">
          {title.split("\n").map((line) => (
            <span
              key={line}
              className="-mb-[0.14em] block overflow-hidden pb-[0.14em]"
            >
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
            <Button
              type="button"
              onClick={primary.onClick}
              className="h-11 px-5"
            >
              {primary.label}
            </Button>
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

export function Statement({
  line1,
  line2,
  tone = "paper",
}: {
  line1: string;
  line2: string;
  tone?: "paper" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <section
      data-reveal-group
      data-nav-surface={isDark ? "ink" : "paper"}
      className={cn(
        "px-4 py-[68px] text-center md:py-[108px]",
        isDark ? "bg-page" : "bg-surface-paper",
      )}
    >
      <p
        data-reveal-line
        className={cn(
          "mx-auto max-w-4xl text-[32px] font-medium leading-none tracking-tight opacity-0 motion-reduce:opacity-100 md:text-buzzStatement",
          isDark ? "text-accent" : "text-on-accent",
        )}
      >
        {line1}
      </p>
      <p
        data-reveal-line
        className={cn(
          "mx-auto mt-1 max-w-4xl text-[32px] font-medium leading-none tracking-tight opacity-0 motion-reduce:opacity-100 md:text-buzzStatement",
          isDark ? "text-primary" : "text-on-accent/55",
        )}
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
      {FEATURED_COLLABS.map((collab) => (
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
          <div className="marketing-stack-copy relative flex w-full flex-col items-start gap-3 px-4 pb-12 md:grid md:grid-cols-[1fr_2fr_1fr] md:items-center md:gap-6 md:px-12 md:pb-0">
            <p className="max-w-xs text-sm text-primary">
              {collab.subtitle}
            </p>
            <h2 className="whitespace-pre-line text-left text-[32px] font-medium leading-none text-primary md:text-center md:text-buzzStatement">
              {collab.title.replace(" x ", "\nx ")}
            </h2>
            <p className="max-w-xs text-sm text-primary md:text-right">
              {`Partnership with ${collab.brand}`}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CurrentDrops() {
  const [index, setIndex] = useState(1);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDocHidden, setIsDocHidden] = useState(
    typeof document !== "undefined" ? document.hidden : false,
  );
  const reduceMotion = useReducedMotion();
  const previousItemCount = useRef(0);
  const { items, isLoading, error, hasNextPage, fetchNextPage, refetch } =
    usePublicDropCatalog();
  const slides = items.length === 1
    ? [items[0], items[0], items[0], items[0]]
    : items.length > 1
      ? [items[items.length - 1], ...items, items[0], items[1]]
      : [];
  useEffect(() => {
    if (items.length === previousItemCount.current) return;
    if (!items.length) setIndex(0);
    else if (!previousItemCount.current) setIndex(1);
    else setIndex(Math.min(index, items.length));
    previousItemCount.current = items.length;
  }, [items.length, index]);
  const displayedIndex = items.length ? (index - 1 + items.length) % items.length : 0;
  const collab = items[displayedIndex];

  const move = async (direction: -1 | 1) => {
    if (direction < 0) {
      if (index > 1) setIndex(index - 1);
      else if (reduceMotion) setIndex(items.length);
      else setIndex(0);
      return;
    }
    if (index < items.length) {
      setIndex(index + 1);
      return;
    }
    if (hasNextPage) {
      const result = await fetchNextPage();
      const count = result.data?.pages.reduce(
        (total, page) => total + page.data.length,
        0,
      ) ?? items.length;
      if (count > items.length) {
        setIndex(index + 1);
        return;
      }
    }
    if (reduceMotion) setIndex(1);
    else setIndex(items.length + 1);
  };

  const resetLoopClone = () => {
    if (index !== 0 && index !== items.length + 1) return;
    setTransitionEnabled(false);
    setIndex(index === 0 ? items.length : 1);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setTransitionEnabled(true));
    });
  };

  useEffect(() => {
    const handleVisibility = () => setIsDocHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const shouldAutoRotate =
    !reduceMotion && !isHovered && !isFocused && !isDocHidden && items.length > 1;

  useEffect(() => {
    if (!shouldAutoRotate) return;
    const delay = Math.floor(3000 + Math.random() * 3000);
    const timer = window.setTimeout(() => {
      void move(1);
    }, delay);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- move is updated per index tick
  }, [index, shouldAutoRotate, items.length]);

  return (
    <section
      data-nav-surface="paper"
      className={cn("bg-surface-paper text-on-accent", SECTION_X, SECTION_Y)}
    >
      <div
        className="mx-auto w-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsFocused(false);
          }
        }}
      >
        <div className="flex items-end justify-between">
          <h2 className="text-[36px] font-medium leading-none tracking-tight md:text-buzzTitle">
            Current drops
          </h2>
          {items.length > 0 ? (
            <div className={cn("flex", GAP.tight)}>
              {([-1, 1] as const).map((direction) => {
                return (
                  <button
                    key={direction}
                    type="button"
                    aria-label={direction < 0 ? "Previous drop" : "Next drop"}
                    onClick={() => void move(direction)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border border-on-accent text-on-accent",
                      focusRingClass,
                    )}
                  >
                    {direction < 0
                      ? <ChevronLeft aria-hidden className={DROP_CAROUSEL.icon} />
                      : <ChevronRight aria-hidden className={DROP_CAROUSEL.icon} />}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {isLoading ? <StatePanel className={DROP_CAROUSEL.topGap}>Loading current drops…</StatePanel> : null}
        {error ? (
          <div className={DROP_CAROUSEL.topGap}>
            <StatePanel tone="danger" title="Could not load current drops">Try again.</StatePanel>
            <div className="mt-3 flex justify-center">
              <Button type="button" variant="outline" onClick={() => void refetch()}>Try again</Button>
            </div>
          </div>
        ) : null}
        {!isLoading && !error && items.length === 0 ? (
          <StatePanel className={DROP_CAROUSEL.topGap}>No current drops right now.</StatePanel>
        ) : null}
        {collab ? (
          <div
            className={DROP_CAROUSEL.container}
            style={DROP_CAROUSEL.style as React.CSSProperties}
          >
          <div className="overflow-hidden">
            <div
              className={cn(
                DROP_CAROUSEL.track,
                transitionEnabled
                  ? "transition-transform duration-500 motion-reduce:transition-none"
                  : "transition-none",
              )}
              data-drop-track
              style={{
                transform: `translateX(calc(${-index} * (${DROP_CAROUSEL.width} + ${DROP_CAROUSEL.gap})))`,
              }}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget) resetLoopClone();
              }}
            >
              {slides.map((item, itemIndex) => {
                const isLightBrand = item.brandName?.trim().toLowerCase() === "saie";
                return (
                  <Link
                    key={`${item.id}-${itemIndex}`}
                    to={publicDropPath(item.id)}
                    tabIndex={itemIndex === index ? 0 : -1}
                    aria-hidden={itemIndex !== index}
                    className={cn("block", DROP_CAROUSEL.slide, focusRingClass)}
                  >
                    <div className="relative aspect-video overflow-hidden rounded-buzzBoard">
                      <RemoteImage
                        src={item.image}
                        label={item.brandName}
                        alt={`${item.brandName}: ${item.title}`}
                        fallback="placeholder"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute left-0 top-0 h-[30%] w-full",
                          isLightBrand
                            ? "bg-gradient-to-b from-white/40 via-white/10 to-transparent"
                            : "bg-gradient-to-b from-black/45 to-transparent",
                        )}
                      />
                      <p
                        className={cn(
                          "absolute text-[28px] font-medium md:text-[32px]",
                          isLightBrand ? "text-[#0a0a0c]" : "text-white",
                          DROP_CAROUSEL.brandInset,
                        )}
                      >
                        {item.brandName}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className={DROP_CAROUSEL.meta}>
            <p className="min-w-0 text-base">{collab.title} · {collab.location}</p>
            <LinkButton
              to={publicDropPath(collab.id)}
              variant="secondary"
              className="shrink-0"
            >
              View drop
            </LinkButton>
          </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type Half = {
  kicker: string;
  title: string;
  support: string;
  action: { label: string; to: string };
  quiet?: { label: string; to: string };
};

export function JoinSplit({ left, right }: { left: Half; right?: Half }) {
  return (
    <section
      data-nav-surface="paper"
      className={cn(
        "grid bg-[#f0f0f0] text-on-accent",
        right && "md:grid-cols-2",
      )}
    >
      <HalfBlock {...left} />
      {right ? <HalfBlock {...right} divided /> : null}
    </section>
  );
}

function HalfBlock({ kicker, title, support, action, quiet, divided }: Half & { divided?: boolean }) {
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

