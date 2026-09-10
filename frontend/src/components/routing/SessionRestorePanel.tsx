/**
 * Soft session-restore failure: refresh worked (or token still present) but
 * `/me` could not be reached. Offer Retry before forcing login.
 */
import { useAuth } from "../../contexts/AuthContext";
import AuthShell from "../site/AuthShell";
import { Button } from "../forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function SessionRestorePanel({
  className = "",
}: {
  className?: string;
}) {
  const { retryRestore, abandonRestore } = useAuth();

  return (
    <AuthShell
      align="center"
      className={cn("items-center text-center", className)}
    >
      <div data-testid="session-restore-panel">
        <h1 className={cn(TEXT.h1, "mb-2 text-buzz-ink")}>
          Couldn&apos;t restore your session
        </h1>
        <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
          We couldn&apos;t reach the server. Your session may still be valid.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            data-testid="session-restore-retry"
            onClick={() => {
              void retryRestore();
            }}
          >
            Retry
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="session-restore-signin"
            onClick={() => abandonRestore()}
          >
            Sign in
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
