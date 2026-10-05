/**
 * /creators/pending — Buzz is reviewing the profile, or has denied it. A
 * denied creator stays here; there is no route to the feed.
 */
import { useCreatorSession } from "../../api/hooks/creator/useCreatorHooks";
import AuthShell from "../../components/site/AuthShell";

export default function CreatorPendingPage() {
  const { data } = useCreatorSession();

  if (data.status === "denied") {
    return (
      <AuthShell align="center" className="text-center">
        <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
          Application <span className="text-buzz-coral">not approved</span>
        </h1>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Buzz isn&apos;t able to add your profile right now. Reach out if you
          think this was a mistake.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell align="center" className="text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Awaiting <span className="text-buzz-coral">Approval</span>
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        Buzz is reviewing your profile. That usually takes about two business
        days. We&apos;ll email you when Instagram is ready to connect.
      </p>
    </AuthShell>
  );
}
