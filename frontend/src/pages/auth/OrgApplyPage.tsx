/**
 * /org/apply — public org apply-first signup (buzz-ops engineering/plans/archive/2026-seeded-launch.md Phase A / PRODUCT §6.1).
 *
 * Collects the full org profile plus a claimed Instagram handle (§6.1.1).
 * The handle is typed and stored unconfirmed until Connect. On success the
 * org waits for .edu verification with no session yet.
 */
import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOrgApplyPrefill } from "../../api/hooks/useOnboardingHooks";
import { SuccessBanner, WarningBanner } from "../../components/forms/controls";
import { AuthHeading, AuthSplit } from "../../components/auth/AuthFrame";
import OrgApplyForm, {
  goToVerifyEmailWait,
} from "../../components/org/OrgApplyForm";

export default function OrgApplyPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prefillToken] = useState(() => searchParams.get("prefill"));
  const prefill = useOrgApplyPrefill(prefillToken);
  const hydratedNotice = useRef(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefillToken) return;
    setSearchParams({}, { replace: true });
  }, [prefillToken, setSearchParams]);

  useEffect(() => {
    if (prefill.isError && prefillToken && !hydratedNotice.current) {
      hydratedNotice.current = true;
      setPrefillError(
        "This apply link is invalid or expired. You can still fill out the form.",
      );
    }
  }, [prefill.isError, prefillToken]);

  return (
    <AuthSplit
      wide
      asideStatement="Join as a student organization and work with brands on real campus campaigns."
    >
      <AuthHeading kicker="Apply as a" title="Student Organization">
        Tell us about your organization. We&apos;ll verify your school email,
        review your application, then invite you to connect Instagram.
      </AuthHeading>
      {prefillError && (
        <div data-testid="org-apply-prefill-error">
          <WarningBanner>{prefillError}</WarningBanner>
        </div>
      )}
      <SuccessBanner icon={<Info className="h-4 w-4" aria-hidden />}>
        Use your organization’s Instagram Business or Creator account, not a
        personal account.
      </SuccessBanner>

      <OrgApplyForm
        prefillToken={prefillToken}
        prefill={prefill.data}
        submitLabel="Submit application"
        onSuccess={(result, eduEmail) => {
          goToVerifyEmailWait(navigate, result, eduEmail);
        }}
      />
    </AuthSplit>
  );
}
