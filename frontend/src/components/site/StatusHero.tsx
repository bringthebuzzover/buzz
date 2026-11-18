/**
 * Centered status screen: glowing bee, title, support. Used inside the
 * public chrome (verify email, connect-link failed, application denied,
 * drop unavailable).
 */
import type { ReactNode } from "react";
import { LinkButton } from "../forms/controls";
import { BeeMark } from "../ui/BrandMark";
import { MOTION } from "../../theme/motion";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function StatusHero({
  title,
  children,
  notice,
  action,
}: {
  title: string;
  children?: ReactNode;
  notice?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[560px] w-full max-w-[720px] flex-col items-center justify-center px-6 py-16 text-center",
        MOTION.publicEnter,
      )}
    >
      <div className="relative mb-2 flex h-[120px] w-[120px] items-center justify-center">
        <div
          className="absolute h-[220px] w-[220px] rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <BeeMark className={cn("relative h-[120px] w-[120px]", MOTION.float)} />
      </div>
      <div className="flex w-full max-w-[520px] flex-col items-center gap-6">
        <h1 className={cn(TEXT.title, "text-primary")}>{title}</h1>
        {children ? (
          <div className="text-base leading-relaxed text-muted">{children}</div>
        ) : null}
        {notice ? <div className="w-full text-left">{notice}</div> : null}
        {action}
      </div>
    </div>
  );
}

/** Home and Log in buttons for public dead ends (404, drop unavailable). */
export function HomeLoginActions() {
  return (
    <div className="flex items-center gap-3">
      <LinkButton to="/">Home</LinkButton>
      <LinkButton to="/login" variant="outline" className="h-10">
        Log in
      </LinkButton>
    </div>
  );
}
