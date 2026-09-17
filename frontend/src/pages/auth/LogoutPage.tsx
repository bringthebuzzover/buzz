/**
 * /logout — visit this URL to sign out the same way as the header Logout
 * control. Waits for auth bootstrap so View-as can exit impersonation instead
 * of revoking the admin cookie underneath.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSignOut } from "../../api/hooks/useSignOut";
import AuthShell from "../../components/site/AuthShell";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function LogoutPage() {
  const { status } = useAuth();
  const signOut = useSignOut();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (status === "idle" || status === "authenticating") return;
    started.current = true;
    signOut();
  }, [status, signOut]);

  return (
    <AuthShell align="center" className="items-center text-center">
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-ink")}>Signing out...</h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        You will be sent home in a moment.
      </p>
    </AuthShell>
  );
}
