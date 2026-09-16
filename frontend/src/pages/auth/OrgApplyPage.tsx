/**
 * /org/apply — public org apply-first signup (LAUNCH.md Phase A / PRODUCT §6.1).
 *
 * Collects the full org profile plus a claimed Instagram handle confirmed via
 * the same-page Business Discovery lookup card (§6.1.1). On success the org
 * waits for .edu verification with no session yet.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOrgApplyPrefill } from "../../api/hooks/useOnboardingHooks";
import { WarningBanner } from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
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
    <PageShell width="form">
      <h1 className={cn(TEXT.h1, "mb-2 text-center text-buzz-ink")}>
        Apply as a <span className="text-buzz-coral">Student Org</span>
      </h1>
      <p className="mb-4 text-center text-sm font-medium text-buzz-inkMuted">
        Tell us about your organization. We&apos;ll verify your school email,
        review your application, then invite you to connect Instagram.
      </p>
      {prefillError && (
        <div className="mb-4" data-testid="org-apply-prefill-error">
          <WarningBanner>{prefillError}</WarningBanner>
        </div>
      )}
      <p className={cn(SURFACE.inset, "mb-8 px-3 py-3 text-xs font-medium text-buzz-inkMuted")}>
        Your Instagram must be the organization&apos;s{" "}
        <span className="font-semibold text-buzz-ink">Business or Creator</span>{" "}
        account — not a personal member profile. Personal accounts cannot be
        used on Buzz.
      </p>

      <OrgApplyForm
        prefillToken={prefillToken}
        prefill={prefill.data}
        submitLabel="Submit application"
        onSuccess={(result, eduEmail) => {
          goToVerifyEmailWait(navigate, result, eduEmail);
        }}
      />
    </PageShell>
  );
}
