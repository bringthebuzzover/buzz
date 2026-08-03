/**
 * /login — Instagram OAuth entry point. Public page.
 */
import { useAuth } from "../../contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import instagramIcon from "../../assets/insta-icon.png";
import { pathForUser } from "../../utils/landing";

export default function LoginPage() {
  const { status, user, login } = useAuth();

  if (status === "authenticated") {
    // Status-aware landing: an active org → feed, mid-onboarding org → their
    // onboarding step, brand → dashboard (matches the OAuth-callback target).
    return <Navigate to={pathForUser(user)} replace />;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-black text-buzz-ink">
        Join or sign in to <span className="text-buzz-coral">Buzz</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        Student organizations sign in with the organization&apos;s Instagram
        Business or Creator account (not a personal member account). You&apos;ll
        verify a
        <span className="whitespace-nowrap"> .edu </span>
        email and go through a quick Buzz review before your portal unlocks.
      </p>

      <button
        type="button"
        onClick={login}
        disabled={status === "authenticating"}
        className="flex items-center gap-3 rounded-xl border-2 border-buzz-coral bg-buzz-paper px-8 py-4 text-base font-bold text-buzz-coral shadow-sm transition hover:bg-buzz-coral hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        <img src={instagramIcon} alt="" className="h-5 w-5" />
        {status === "authenticating"
          ? "Logging in..."
          : "Continue with Instagram"}
      </button>

      <p className="mt-8 text-sm font-medium text-buzz-inkMuted">
        Are you a brand?{" "}
        <Link to="/brand/login" className="font-bold text-buzz-coral hover:underline">
          Brand login
        </Link>
      </p>
    </div>
  );
}
