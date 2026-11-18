/**
 * Fixed red bar shown whenever an admin is viewing as another user.
 *
 * Deliberately loud and always on top: the whole risk of impersonation is
 * forgetting you are in it. Exit restores the admin session in-SPA (see
 * `useEndImpersonation`).
 */
import { useAuth } from "../../contexts/AuthContext";
import { useEndImpersonation } from "../../api/hooks/useEndImpersonation";

export default function ImpersonationBanner() {
  const { user } = useAuth();
  const endImpersonation = useEndImpersonation();

  if (!user?.impersonatedBy) return null;

  const label = user.instagramUsername
    ? `@${user.instagramUsername}`
    : `${user.portalRole} account`;

  return (
    <div
      role="status"
      data-testid="impersonation-banner"
      className="sticky top-0 z-buzzBanner flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-buzz-dangerFill px-4 py-2 text-center text-sm font-semibold text-buzz-fg"
    >
      <span>
        Viewing as {label}
        {user.impersonationReadonly ? " (read-only)" : ""}
      </span>
      <button
        type="button"
        data-testid="exit-impersonation"
        onClick={() => {
          void endImpersonation();
        }}
        className="rounded-full border border-buzz-fg/40 px-3 py-0.5 text-xs font-medium uppercase tracking-wide transition hover:bg-buzz-fg hover:text-buzz-dangerFill"
      >
        Exit impersonation
      </button>
    </div>
  );
}
