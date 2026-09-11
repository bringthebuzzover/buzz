/**
 * /reconnect-instagram — public reconnect surface when an org’s Instagram
 * long-lived token is past expiry. Must not call authenticated APIs (anti-loop
 * with apiFetch hard-nav). Usable under idle / error / needs_instagram_reconnect.
 */
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import instagramIcon from "../../assets/insta-icon.png";
import AuthShell from "../../components/site/AuthShell";
import { Button } from "../../components/forms/controls";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function ReconnectInstagramPage() {
  const { login, status } = useAuth();

  return (
    <AuthShell align="center" className="items-center text-center">
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-ink")}>
        Reconnect <span className="text-buzz-coral">Instagram</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        Your organization&apos;s Instagram connection expired. Buzz can&apos;t
        refresh an already-expired token — reconnect with the organization&apos;s
        Instagram Business or Creator account to restore portal access.
      </p>

      <Button
        type="button"
        variant="outline"
        size="hero"
        data-testid="reconnect-instagram-cta"
        onClick={login}
        disabled={status === "authenticating"}
      >
        <img src={instagramIcon} alt="" className="h-5 w-5" />
        {status === "authenticating"
          ? "Connecting…"
          : "Reconnect with Instagram"}
      </Button>

      <div className={cn("mt-8", STACK.default, "text-sm font-medium text-buzz-inkMuted")}>
        <p>
          <Link to="/" className="font-semibold text-buzz-coral hover:underline">
            Back to home
          </Link>
        </p>
        <p>
          Are you a brand?{" "}
          <Link to="/brand/login" className="font-semibold text-buzz-coral hover:underline">
            Brand login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
