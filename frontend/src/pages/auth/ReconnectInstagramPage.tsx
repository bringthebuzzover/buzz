/**
 * /reconnect-instagram — public reconnect surface when an org’s Instagram
 * long-lived token is past expiry. Must not call authenticated APIs (anti-loop
 * with apiFetch hard-nav). Usable under idle / error / needs_instagram_reconnect.
 */
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import instagramIcon from "../../assets/insta-icon.png";

export default function ReconnectInstagramPage() {
  const { login, status } = useAuth();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-black text-buzz-ink">
        Reconnect <span className="text-buzz-coral">Instagram</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        Your organization&apos;s Instagram connection expired. Buzz can&apos;t
        refresh an already-expired token — reconnect with the organization&apos;s
        Instagram Business or Creator account to restore portal access.
      </p>

      <button
        type="button"
        data-testid="reconnect-instagram-cta"
        onClick={login}
        disabled={status === "authenticating"}
        className="flex items-center gap-3 rounded-xl border-2 border-buzz-coral bg-buzz-paper px-8 py-4 text-base font-bold text-buzz-coral shadow-sm transition hover:bg-buzz-coral hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        <img src={instagramIcon} alt="" className="h-5 w-5" />
        {status === "authenticating"
          ? "Connecting…"
          : "Reconnect with Instagram"}
      </button>

      <p className="mt-8 text-sm font-medium text-buzz-inkMuted">
        <Link to="/" className="font-bold text-buzz-coral hover:underline">
          Back to home
        </Link>
      </p>

      <p className="mt-4 text-sm font-medium text-buzz-inkMuted">
        Are you a brand?{" "}
        <Link to="/brand/login" className="font-bold text-buzz-coral hover:underline">
          Brand login
        </Link>
      </p>
    </div>
  );
}
