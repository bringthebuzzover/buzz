/**
 * Catch-all unmatched URL (SiteLayout splat and nested admin splat).
 * Public routes use the Pulse Black status scene. Admin keeps a plain panel
 * inside its own shell.
 */
import { useLocation } from "react-router-dom";
import { StatusHero } from "../components/marketing/sections";
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
    <div className="bg-page">
      <StatusHero kicker="404" title="This page does not exist." />
    </div>
  );
}
