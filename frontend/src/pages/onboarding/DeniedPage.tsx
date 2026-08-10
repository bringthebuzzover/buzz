/**
 * /onboarding/denied — terminal "no portal access" screen for orgs whose
 * application was denied. Reachable without a live session (access TTL /
 * failed refresh) so denial UX survives logout; Instagram callback also lands
 * here on ACCOUNT_DENIED.
 */
export default function DeniedPage() {
  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-coral">
        Application Denied
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        Your organization's application was not approved. Contact Buzz support
        if you have questions.
      </p>
    </div>
  );
}
