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
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-700 px-4 py-2 text-center text-sm font-bold text-white"
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
        className="rounded border border-white/70 px-3 py-0.5 text-xs font-bold uppercase tracking-wide transition hover:bg-white hover:text-red-700"
      >
        Exit impersonation
      </button>
    </div>
  );
}
