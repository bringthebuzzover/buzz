/**
 * Minimal header for admin login.
 * The public SiteHeader stays untouched; this is a separate component.
 */
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../ui/BrandMark";
import { Chip } from "../ui/Chip";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

export default function AuthAdminHeader() {
  return (
    <header className="flex min-h-16 w-full flex-wrap items-center gap-5 border-b border-transparent px-6 py-3 lg:px-12">
      <div className="flex items-center gap-3">
        <Logo className="h-6 w-[79px]" />
        <Chip accent className="px-2 py-0.5 text-xs font-medium normal-case">
          admin
        </Chip>
      </div>
      <div className="hidden min-w-[1px] flex-1 sm:block" />
      <Link
        to="/"
        className={cn(
          "inline-flex items-center gap-2 rounded-full text-sm text-muted",
          focusRingClass,
        )}
      >
        Back to bringthebuzzover.com
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </header>
  );
}
