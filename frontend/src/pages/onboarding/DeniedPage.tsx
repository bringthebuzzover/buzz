/**
 * /onboarding/denied — terminal "no portal access" screen for orgs whose
 * application was denied. Reachable without a live session (access TTL /
 * failed refresh) so denial UX survives logout; Instagram callback also lands
 * here on ACCOUNT_DENIED.
 */
import StatusHero from "../../components/site/StatusHero";
import { AnchorButton } from "../../components/forms/controls";
import { siteIdentity } from "../../data/siteIdentity";

export default function DeniedPage() {
  const { contact } = siteIdentity;
  return (
    <StatusHero
      title="Application Denied"
      action={
        <AnchorButton
          href={`mailto:${contact.email}`}
          variant="outline"
        >
          Contact
        </AnchorButton>
      }
    >
      Your organization&apos;s application was not approved. Contact BUZZ
      support if you have questions.
    </StatusHero>
  );
}
