/**
 * Catch-all unmatched URL (SiteLayout splat and nested admin splat).
 * Public routes use the Pulse Black status scene. Admin keeps a plain panel
 * inside its own shell.
 */
import { useLocation } from "react-router-dom";
import { HomeLoginActions } from "../components/site/StatusHero";
import { BeeMark } from "../components/ui/BrandMark";
import { TEXT } from "../theme/tokens";

export default function NotFoundPage() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) {
    return (
      <div className="px-6 py-16 text-primary">
        <h1 className={TEXT.h1}>404</h1>
        <p className="mt-4 text-sm text-muted">This page does not exist.</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-[640px] flex-col items-center justify-center bg-page px-4 py-16 text-center text-primary">
      <h1 className="text-[48px] font-medium leading-none text-accent md:text-buzzDisplay">404</h1>
      <BeeMark className="h-[120px] w-[120px] motion-safe:animate-buzz-float" />
      <p className="mt-6 max-w-xl text-xl font-medium leading-tight">This page does not exist.</p>
      <div className="mt-6">
        <HomeLoginActions />
      </div>
    </div>
  );
}
