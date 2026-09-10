/**
 * /onboarding/denied — terminal "no portal access" screen for orgs whose
 * application was denied. Reachable without a live session (access TTL /
 * failed refresh) so denial UX survives logout; Instagram callback also lands
 * here on ACCOUNT_DENIED.
 */
import AuthShell from "../../components/site/AuthShell";
import { StatePanel } from "../../components/ui/StatePanel";

export default function DeniedPage() {
  return (
    <AuthShell align="center">
      <StatePanel tone="danger" title="Application Denied">
        Your organization&apos;s application was not approved. Contact Buzz
        support if you have questions.
      </StatePanel>
    </AuthShell>
  );
}
