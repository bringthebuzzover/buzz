/**
 * Catch-all unmatched URL (SiteLayout splat and nested admin splat).
 * Mirror RequireRole 403 chrome; do not wrap in auth guards.
 */
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-8 py-24 text-center">
      <h1 className="mb-4 text-4xl font-black text-buzz-coral">404</h1>
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
    </div>
  );
}
