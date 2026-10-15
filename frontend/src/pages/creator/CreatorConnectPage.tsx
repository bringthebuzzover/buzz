/**
 * /creators/connect — first Instagram connect after approval. The button
 * stands in for the Instagram OAuth redirect.
 */
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import {
  useConnectCreatorInstagram,
  useCreatorProfile,
} from "../../api/hooks/creator/useCreatorHooks";
import { Button } from "../../components/forms/controls";
import AuthShell from "../../components/site/AuthShell";

export default function CreatorConnectPage() {
  const navigate = useNavigate();
  const { data: profile } = useCreatorProfile();
  const connect = useConnectCreatorInstagram();
  const { user } = useAuth();

  return (
    <AuthShell align="center" className="text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        You&apos;re <span className="text-buzz-coral">approved</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        Connect{" "}
        <span className="font-semibold text-buzz-ink">{profile?.claimedHandle}</span>{" "}
        to open your portal. Buzz reads your follower and post counts from
        Instagram; it never posts for you.
      </p>
      <Button
        type="button"
        fullWidth
        disabled={connect.isPending}
        onClick={() => {
          if (user?.portalRole === "creator") {
            void apiFetch<{ authorizeUrl?: string; authorize_url?: string }>(
              "/api/auth/instagram/bind-start?next=%2Fcreators%2Ffeed",
              { method: "POST" },
            ).then(({ data }) => {
              const url = data.authorizeUrl ?? data.authorize_url;
              if (url) window.location.assign(url);
            });
            return;
          }
          connect.mutate();
          navigate("/creators/feed");
        }}
      >
        Connect Instagram
      </Button>
    </AuthShell>
  );
}
