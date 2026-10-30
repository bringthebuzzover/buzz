/**
 * Presentational phone screens for the public marketing pages.
 * Inert copies of the app (pass 8): photos, avatars, chips. No handlers.
 */
import { BeeMark, Logo } from "../ui/BrandMark";
import { cn } from "../../theme/cn";
import { MOCKUP, MOCKUP_ALT, SAMPLE } from "./mockups";

function Photo({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

function Scrim({ strongTop = false }: { strongTop?: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 bg-gradient-to-t from-page via-page/70 to-page/20",
        strongTop && "from-page via-page/50 to-page/75",
      )}
    />
  );
}

function Avatar({
  initials,
  tone = "yellow",
  className,
}: {
  initials: string;
  tone?: "yellow" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium",
        tone === "yellow"
          ? "bg-accent text-on-accent"
          : "border-2 border-page bg-surface-card text-primary",
        className,
      )}
    >
      {initials}
    </span>
  );
}

function MockField({
  label,
  value,
  hint,
  hideHintOnMobile = false,
}: {
  label: string;
  value: string;
  hint?: string;
  hideHintOnMobile?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex h-9 items-center rounded-buzzField border border-line bg-surface-tile px-3 text-xs text-primary">
        {value}
      </div>
      {hint ? (
        <div className={cn("mt-1 text-xs text-quiet", hideHintOnMobile && "hidden md:block")}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function YellowPill({ children }: { children: string }) {
  return (
    <div className="flex h-10 w-full items-center justify-center rounded-full bg-accent text-sm text-on-accent">
      {children}
    </div>
  );
}

function LogoBar({ trailing }: { trailing?: string }) {
  return (
    <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-4">
      <Logo className="h-[18px]" />
      {trailing ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-on-accent">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

function OrgApply(_props: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-page">
      <LogoBar />
      <div className="relative h-24 shrink-0 overflow-hidden">
        <Photo src={MOCKUP.event} alt={MOCKUP_ALT.event} eager className="absolute inset-0" />
        <Scrim />
        <div className="relative flex h-full flex-col justify-end gap-1 px-5 py-3">
          <BeeMark className="absolute right-3 top-2 hidden h-[22px] w-[22px] md:block" />
          <p className="text-xs font-medium text-accent">FOR STUDENT ORGANIZATIONS</p>
          <p className="text-sm font-medium leading-snug text-primary">
            Get products for your next event.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 py-4">
        <div>
          <p className="text-xs text-muted">Apply as a</p>
          <p className="text-base font-medium text-primary">Student Organization</p>
        </div>
        <MockField label="Organization name" value={SAMPLE.org} />
        <div className="hidden md:block">
          <MockField label="University" value={SAMPLE.university} />
        </div>
        <MockField
          label="School (.edu) email"
          value={SAMPLE.email}
          hint="We'll email a verification link."
          hideHintOnMobile
        />
        <div className="mt-auto pt-2">
          <YellowPill>Submit application</YellowPill>
        </div>
      </div>
    </div>
  );
}

function OrgInstagram(_props: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col gap-3 bg-page px-4 py-4">
      <Logo className="h-[18px]" />
      <div>
        <p className="text-xs text-muted">Apply as a</p>
        <p className="text-base font-medium text-primary">Student Organization</p>
      </div>
      <div className="rounded-buzzBoard border border-line bg-accent-wash px-3 py-2 text-xs leading-snug text-primary">
        Your Instagram must be the organization&apos;s Business or Creator account,
        not a personal profile.
      </div>
      <MockField
        label="Instagram handle"
        value={SAMPLE.handle}
        hint="The organization's account, not a personal one."
      />
      <div className="rounded-buzzBoard border border-line bg-surface-card p-3">
        <div className="flex items-center gap-2">
          <Avatar initials="SO" />
          <div className="min-w-0">
            <p className="text-sm text-primary">{SAMPLE.handle}</p>
            <p className="hidden text-xs text-muted md:block">{SAMPLE.university}</p>
          </div>
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-on-accent">
            Business
          </span>
        </div>
        <div className="mt-3 hidden grid-cols-3 gap-1.5 md:grid">
          <Tile src={MOCKUP.table} alt={MOCKUP_ALT.table} />
          <Tile src={MOCKUP.event} alt={MOCKUP_ALT.event} />
          <Tile src={MOCKUP.study} alt={MOCKUP_ALT.study} />
        </div>
      </div>
      <div className="mt-auto">
        <YellowPill>Submit application</YellowPill>
      </div>
    </div>
  );
}

function Tile({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="aspect-square overflow-hidden rounded-buzzField">
      <Photo src={src} alt={alt} />
    </div>
  );
}

function OrgConnect(_props: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-page px-4 py-4">
      <Logo className="h-[18px]" />
      <p className="mt-4 text-xs text-muted">Organizations</p>
      <p className="text-lg font-medium leading-tight text-primary">
        Join or sign in to BUZZ
      </p>
      <div className="relative mt-4 overflow-hidden rounded-buzzBoard">
        <div className="aspect-[16/9]">
          <Photo src={MOCKUP.table} alt={MOCKUP_ALT.table} />
        </div>
        <Scrim />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-on-accent">
            Approved
          </span>
          <Avatar initials="SO" />
          <p className="text-xs text-primary">
            {SAMPLE.org} · {SAMPLE.university}
          </p>
        </div>
      </div>
      <div className="mt-auto">
        <YellowPill>Continue with Instagram</YellowPill>
      </div>
    </div>
  );
}

function OrgDrop({ animate }: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-page">
      <div className="flex h-[52px] items-center justify-between border-b border-line px-4">
        <div>
          <Logo className="h-[18px]" />
          <p className="text-[12px] text-muted">Organization Portal</p>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-on-accent">
          SO
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">
        <p className="text-sm font-medium text-primary">Browse campaigns</p>
        <div className="flex gap-1.5 overflow-hidden">
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            All drops
          </span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            Upcoming
          </span>
          <span
            className={cn(
              "rounded-full bg-accent px-2 py-0.5 text-xs text-on-accent",
              animate && "motion-safe:animate-buzz-fade",
            )}
          >
            Open
          </span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            Closed
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Current drops <span className="text-primary">2</span>
          </span>
          <span aria-hidden>‹ ›</span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-buzzBoard">
          <Photo src={MOCKUP.cans} alt={MOCKUP_ALT.cans} className="absolute inset-0" />
          <Scrim strongTop />
          <div className="absolute left-2 top-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-xs text-primary">Open</span>
            <span className="ml-2 text-xs text-primary">{SAMPLE.drop.spots}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-xs tracking-wide text-muted">SAMPLE BRAND</p>
            <p className="text-base font-medium leading-tight text-primary">
              {SAMPLE.drop.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{SAMPLE.drop.description}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">{SAMPLE.university}</span>
              <span className="rounded-full bg-accent px-3 py-1 text-xs text-on-accent">
                Apply
              </span>
            </div>
          </div>
          <div className="absolute -right-6 top-8 hidden h-[70%] w-10 overflow-hidden rounded-l-buzzField md:block">
            <Photo src={MOCKUP.bottle} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandRequest(_props: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-page">
      <div className="flex h-[52px] items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <Logo className="h-[18px]" />
          <span className="text-xs text-muted">Brand Portal</span>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-on-accent">
          SB
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">
        <p className="text-xs text-muted">Brand Portal</p>
        <p className="text-base font-medium text-primary">Request a drop</p>
        <div className="rounded-buzzBoard border border-line p-3">
          <p className="text-sm font-medium text-primary">The campaign</p>
          <p className="mt-2 text-xs text-muted">Tell us about the campaign</p>
          <p className="mt-1 text-xs leading-snug text-primary">{SAMPLE.campaign}</p>
          <p className="mt-2 text-xs text-muted">What you&apos;re sending</p>
          <p className="mt-1 text-xs text-primary">{SAMPLE.sending}</p>
          <div className="mt-2 flex items-end gap-1.5">
            <Thumb src={MOCKUP.cans} alt={MOCKUP_ALT.cans} />
            <Thumb src={MOCKUP.bottle} alt={MOCKUP_ALT.bottle} />
            <Thumb src={MOCKUP.box} alt={MOCKUP_ALT.box} className="hidden md:block" />
            <p className="pb-1 text-[12px] leading-tight text-muted">
              200 cans + koozies
              <br />
              Product photos
            </p>
          </div>
        </div>
        <div className="mt-auto">
          <YellowPill>Send request</YellowPill>
        </div>
      </div>
    </div>
  );
}

function Thumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("h-10 w-10 overflow-hidden rounded-buzzField", className)}>
      <Photo src={src} alt={alt} />
    </div>
  );
}

function BrandBuilt(_props: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col gap-3 bg-page px-3 py-3">
      <div className="flex items-center justify-between">
        <div>
          <Logo className="h-[18px]" />
          <p className="text-xs text-muted">Brand Portal</p>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-on-accent">
          SB
        </span>
      </div>
      <p className="text-base font-medium text-primary">Dashboard</p>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Drops" value="1" />
        <Stat label="Spots" value="8" />
      </div>
      <p className="text-sm font-medium text-primary">Requests</p>
      <div className="flex items-center gap-2 rounded-buzzBoard border border-line p-2">
        <Thumb src={MOCKUP.cans} alt={MOCKUP_ALT.cans} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-primary">{SAMPLE.drop.title}</p>
          <p className="text-[12px] text-muted">Sent Oct 27, 2026</p>
          <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[12px] text-on-accent">
            Drop built
          </span>
        </div>
        <span className="text-xs text-muted">View drop</span>
      </div>
      <div className="relative hidden overflow-hidden rounded-buzzBoard md:block">
        <div className="aspect-[16/8]">
          <Photo src={MOCKUP.table} alt={MOCKUP_ALT.table} />
        </div>
        <Scrim />
        <div className="absolute inset-x-0 bottom-0 p-2">
          <p className="text-[12px] text-primary">Open · {SAMPLE.drop.spots}</p>
          <p className="text-[12px] text-muted">SAMPLE BRAND</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-buzzCard border border-line bg-surface-tile px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-medium text-primary">{value}</p>
    </div>
  );
}

function BrandSelect({ animate }: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-page">
      <div className="flex h-10 items-center px-3 text-xs text-muted">‹ Back to dashboard</div>
      <div className="relative mx-3 overflow-hidden rounded-buzzBoard">
        <div className="h-16">
          <Photo src={MOCKUP.cans} alt={MOCKUP_ALT.cans} className="absolute inset-0" />
        </div>
        <Scrim />
        <div className="absolute inset-0 flex flex-col justify-end p-2">
          <span className="w-fit rounded-full bg-accent px-2 py-0.5 text-[12px] text-on-accent">
            Selecting
          </span>
          <p className="text-sm font-medium text-primary">{SAMPLE.drop.title}</p>
          <p className="text-[12px] text-muted">
            SAMPLE BRAND · {SAMPLE.university}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-3">
        <div className="flex items-center gap-1">
          <Avatar initials="SO" />
          <Avatar initials="OB" tone="muted" className="-ml-2" />
        </div>
        <p className="text-sm font-medium text-primary">Applicants</p>
        <div>
          <div className="mb-1 flex justify-between text-[12px] text-muted">
            <span>Capacity</span>
            <span>1 of 8 spots</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[12.5%] rounded-full bg-accent" />
          </div>
        </div>
        <Applicant
          initials="SO"
          name={SAMPLE.org}
          handle={SAMPLE.handle}
          followers="4,200 followers"
          on
          animate={animate}
        />
        <Applicant
          initials="OB"
          name={SAMPLE.orgB}
          handle={SAMPLE.handleB}
          followers="1,100 followers"
          on={false}
        />
        <p className="text-xs text-muted">Accept 1 · Deny 1</p>
        <div className="mt-auto">
          <YellowPill>Send decisions</YellowPill>
        </div>
      </div>
    </div>
  );
}

function Applicant({
  initials,
  name,
  handle,
  followers,
  on,
  animate = false,
}: {
  initials: string;
  name: string;
  handle: string;
  followers: string;
  on: boolean;
  animate?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar initials={initials} tone={on ? "yellow" : "muted"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-primary">{name}</p>
        <p className="truncate text-[12px] text-muted">
          {handle}
          <span className="hidden md:inline"> · {followers}</span>
        </p>
      </div>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          on ? "bg-accent" : "bg-white/15",
          animate && on && "motion-safe:animate-buzz-fade",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-page",
            on ? "right-0.5" : "left-0.5",
          )}
        />
      </span>
    </div>
  );
}

function BrandTrack({ animate }: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-page">
      <div className="flex h-10 items-center px-3 text-xs text-muted">‹ Back to dashboard</div>
      <div className="relative mx-3 overflow-hidden rounded-buzzBoard">
        <div className="h-16">
          <Photo src={MOCKUP.cans} alt={MOCKUP_ALT.cans} className="absolute inset-0" />
        </div>
        <Scrim />
        <div className="absolute inset-0 flex flex-col justify-end p-2">
          <span className="w-fit rounded-full bg-accent px-2 py-0.5 text-[12px] text-on-accent">
            Wrapped
          </span>
          <p className="text-sm font-medium text-primary">{SAMPLE.drop.title}</p>
          <p className="text-[12px] text-muted">SAMPLE BRAND</p>
        </div>
      </div>
      <div className="px-3 py-3">
        <p className="mb-2 text-sm font-medium text-primary">Drop status</p>
        <div className="grid grid-cols-3 gap-1 text-center text-[12px] text-muted">
          <span>Selecting</span>
          <span>Live</span>
          <span className="text-primary">Wrapped</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full bg-accent",
              animate ? "w-full motion-safe:animate-buzz-fade" : "w-full",
            )}
          />
        </div>
      </div>
      <div className="px-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-primary">Posts by organization</p>
          <span className="text-xs text-muted" aria-hidden>
            ⌂
          </span>
        </div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <Avatar initials="SO" />
          <Avatar initials="OB" tone="muted" className="-ml-3" />
          <span>2 organizations · 3 posts</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Tile src={MOCKUP.table} alt={MOCKUP_ALT.table} />
          <Tile src={MOCKUP.event} alt={MOCKUP_ALT.event} />
          <Tile src={MOCKUP.study} alt={MOCKUP_ALT.study} />
        </div>
      </div>
    </div>
  );
}

const ORG_SCREENS = [OrgApply, OrgInstagram, OrgConnect, OrgDrop] as const;
const BRAND_SCREENS = [BrandRequest, BrandBuilt, BrandSelect, BrandTrack] as const;

export function MarketingPhone({
  kind,
  step,
  animate,
}: {
  kind: "org" | "brand";
  step: number;
  animate: boolean;
}) {
  const screens = kind === "org" ? ORG_SCREENS : BRAND_SCREENS;
  return (
    <div
      aria-hidden
      className="relative h-[444px] w-[250px] overflow-hidden rounded-buzzPhone border border-on-accent/10 bg-page shadow-buzz md:h-[563px] md:w-[317px]"
    >
      {screens.map((Screen, index) => (
        <div
          key={index}
          className={cn(
            "absolute inset-0 transition-opacity duration-300 ease-out motion-reduce:transition-none",
            index === step ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <Screen animate={animate && index === step} />
        </div>
      ))}
    </div>
  );
}
