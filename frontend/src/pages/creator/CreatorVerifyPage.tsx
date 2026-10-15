/**
 * /creators/verify — waits for the creator to open the .edu verification
 * link. The button stands in for that link until the email is sent for real.
 */
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import {
  useConfirmCreatorEmail,
  useCreatorProfile,
} from "../../api/hooks/creator/useCreatorHooks";
import { Button } from "../../components/forms/controls";
import AuthShell from "../../components/site/AuthShell";

export default function CreatorVerifyPage() {
  const navigate = useNavigate();
  const { data: profile } = useCreatorProfile();
  const confirmEmail = useConfirmCreatorEmail();
  const [params] = useSearchParams();
  const token = params.get("token");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void apiFetch("/api/creators/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(() => {
      if (!cancelled) navigate("/creators/pending");
    });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <AuthShell align="center" className="text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Check your <span className="text-buzz-coral">campus email</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        We sent a verification link to{" "}
        <span className="font-semibold text-buzz-ink">{profile?.eduEmail}</span>.
        Campus inboxes often put first-time Buzz mail in Junk.
      </p>
      <Button
        type="button"
        fullWidth
        disabled={confirmEmail.isPending}
        onClick={() => {
          confirmEmail.mutate();
          navigate("/creators/pending");
        }}
      >
        Open verification link
      </Button>
    </AuthShell>
  );
}
