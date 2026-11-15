/**
 * /onboarding/pending-approval — waiting screen for orgs awaiting admin review.
 *
 * Polls the current user every 15s so that once an admin approves (status →
 * active) or denies (→ denied) the account, the route guard forwards the user
 * automatically without a manual refresh. School email is locked on this
 * screen; a swap already in flight is only shown, not editable.
 */
import { useEffect } from "react";
import { Info } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Notice } from "../../components/forms/controls";
import StatusHero from "../../components/site/StatusHero";
import { TEXT } from "../../theme/tokens";
import { pathForUser } from "../../utils/landing";

const POLL_INTERVAL_MS = 15_000;

export default function PendingApprovalPage() {
  const { user, refreshUser } = useAuth();
  const [params] = useSearchParams();

  useEffect(() => {
    if (!user || user.status !== "pending_approval") return;
    const id = window.setInterval(() => {
      void refreshUser();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [user, refreshUser]);

  if (!user || user.status !== "pending_approval") {
    // Poll resolved (or wrong status / no session): route to where the user
    // belongs — active → portal, denied → denial page, none → login.
    return <Navigate to={pathForUser(user, params.get("next"))} replace />;
  }

  return (
    <StatusHero
      title="Application Received"
      notice={
        user.pendingEduEmail ? (
          <Notice
            tone="accent"
            icon={<Info className="h-4 w-4" aria-hidden />}
          >
            {`Verification link sent to ${user.pendingEduEmail}. Confirm your new school email.`}
          </Notice>
        ) : user.email ? (
          <Notice
            tone="success"
            icon={<Info className="h-4 w-4" aria-hidden />}
          >
            {`Verified campus email: ${user.email}. We're reviewing your application.`}
          </Notice>
        ) : undefined
      }
    >
      <p>
        We&apos;re reviewing your organization. BUZZ curates vetted campus
        communities to guarantee high-quality brand collaborations.
      </p>
      <p className={TEXT.meta}>
        Your school email is locked while we review your application.
      </p>
    </StatusHero>
  );
}
