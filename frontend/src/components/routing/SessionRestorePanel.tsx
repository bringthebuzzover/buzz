/**
 * Soft session-restore failure: refresh worked (or token still present) but
 * `/me` could not be reached. Offer Retry before forcing login.
 */
import { useAuth } from "../../contexts/AuthContext";

export default function SessionRestorePanel({
  className = "",
}: {
  className?: string;
}) {
  const { retryRestore, abandonRestore } = useAuth();

  return (
    <div
      className={`mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-8 py-16 text-center ${className}`}
      data-testid="session-restore-panel"
    >
      <h1 className="mb-2 text-2xl font-bold text-buzz-ink">
        Couldn&apos;t restore your session
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        We couldn&apos;t reach the server. Your session may still be valid.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          data-testid="session-restore-retry"
          onClick={() => {
            void retryRestore();
          }}
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper transition hover:bg-buzz-coralDark"
        >
          Retry
        </button>
        <button
          type="button"
          data-testid="session-restore-signin"
          onClick={() => abandonRestore()}
          className="rounded-lg border border-buzz-lineMid bg-buzz-cream px-6 py-3 text-sm font-bold text-buzz-ink transition hover:border-buzz-coral"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
