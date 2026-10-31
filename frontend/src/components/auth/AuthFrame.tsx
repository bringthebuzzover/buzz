/**
 * Pulse Black auth frames from the pen: photo aside + 440/640 form, or a
 * centered column under AuthAdminHeader.
 */
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BeeMark, Logo } from "../ui/BrandMark";
import { focusRingClass } from "../../theme/controls";
import { MOTION } from "../../theme/motion";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { publicAsset } from "../../utils/publicAsset";

const ASIDE_STATEMENT =
  "Connecting brands with campus communities for authentic college marketing, at scale.";

/** Quiet legal links for auth frames that hide the site footer. */
function AuthLegalLinks() {
  const linkClass = cn("rounded-full text-muted", focusRingClass);
  return (
    <p className="text-sm text-quiet" data-testid="auth-legal-links">
      <Link to="/privacy" className={linkClass}>
        Privacy
      </Link>
      <span aria-hidden> · </span>
      <Link to="/terms" className={linkClass}>
        Terms
      </Link>
    </p>
  );
}

function BeeFlight() {
  const dots = [3, 3.4, 3.8, 4.1, 4.5, 4.9, 5.2, 5.6, 6];
  return (
    <div className="relative h-[110px] w-full max-w-[310px]" aria-hidden>
      <svg viewBox="0 0 270 80" className="h-full w-[270px] max-w-full">
        {dots.map((size, i) => {
          const t = i / (dots.length - 1);
          const x = 8 + t * 210;
          const y = 62 - Math.sin(t * Math.PI) * 48;
          return (
            <circle
              key={size}
              cx={x}
              cy={y}
              r={size / 2}
              className="fill-primary"
              opacity={0.35 + t * 0.65}
            />
          );
        })}
      </svg>
      <BeeMark className="absolute bottom-2 left-0 h-10 w-10 animate-buzz-aside-bee motion-reduce:animate-none" />
    </div>
  );
}

function AuthAside() {
  return (
    <aside
      data-testid="auth-aside"
      className="relative flex min-h-[420px] w-full shrink-0 flex-col overflow-hidden lg:min-h-screen lg:w-[620px]"
    >
      <picture>
        <source
          type="image/webp"
          srcSet={publicAsset("auth-update-toast.webp")}
        />
        <img
          src={publicAsset("auth-update-toast.jpg")}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[50%_40%]"
        />
      </picture>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b0b0b33,#0b0b0bf2)]" />
      <div className="relative flex flex-1 flex-col gap-5 p-8 lg:p-12">
        <Logo className="h-10 w-32" />
        <div className="flex-1" />
        <p className={cn(TEXT.statement, "max-w-[34rem] text-primary")}>
          {ASIDE_STATEMENT}
        </p>
        <p className="text-sm text-quiet">bringthebuzzover.com</p>
        <AuthLegalLinks />
        <BeeFlight />
      </div>
    </aside>
  );
}

export function AuthSplit({
  wide = false,
  children,
}: {
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-page lg:flex-row">
      <AuthAside />
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12 lg:py-16">
        <div
          data-testid="auth-form"
          className={cn(
            "w-full space-y-6",
            wide ? "max-w-[640px]" : "max-w-[440px]",
            MOTION.publicEnter,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Centered column for the admin auth shell (header is rendered by the layout). */
export function AuthCenter({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-6 py-16 lg:px-12">
      <div
        data-testid="auth-form"
        className={cn("w-full max-w-[440px] space-y-6", MOTION.publicEnter)}
      >
        {children}
        <AuthLegalLinks />
      </div>
    </div>
  );
}

export function AuthHeading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-accent">{kicker}</p>
      <h1 className={cn(TEXT.h1, "text-primary")}>{title}</h1>
      {children ? (
        <p className={cn(TEXT.bodyLong, "text-muted")}>{children}</p>
      ) : null}
    </div>
  );
}

const linkClass = cn(
  "inline-flex items-center gap-2 rounded-full text-sm text-muted",
  focusRingClass,
);

export function AuthArrowLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={linkClass}>
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

export function AuthBackLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={linkClass}>
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}

export function AuthLinkRow({
  quiet,
  children,
}: {
  quiet?: ReactNode;
  children: ReactNode;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      {quiet ? <span className="text-quiet">{quiet}</span> : null}
      {children}
    </p>
  );
}
