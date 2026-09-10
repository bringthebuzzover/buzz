/**
 * Catch-all unmatched URL (SiteLayout splat and nested admin splat).
 * Mirror RequireRole 403 chrome; do not wrap in auth guards.
 */
import { Link } from "react-router-dom";
import AuthShell from "../components/site/AuthShell";
import { TEXT } from "../theme/tokens";
import { cn } from "../theme/cn";

export default function NotFoundPage() {
  return (
    <AuthShell align="center" className="text-center">
      <h1 className={cn(TEXT.h1, "mb-4")}>404</h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        This page does not exist.
      </p>
      <p className="mt-6 space-x-4 text-sm font-medium">
        <Link to="/" className="text-buzz-coral hover:underline">
          Home
        </Link>
        <Link to="/login" className="text-buzz-coral hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
