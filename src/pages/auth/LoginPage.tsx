/**
 * /login — Instagram OAuth entry point. Public page.
 */
import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import instagramIcon from "../../assets/insta-icon.png";

export default function LoginPage() {
  const { status, login } = useAuth();

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-black text-buzz-ink">
        Welcome to <span className="text-buzz-coral">Buzz</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        Log in with your Instagram account to get started.
      </p>

      <button
        type="button"
        onClick={login}
        disabled={status === "authenticating"}
        className="flex items-center gap-3 rounded-xl border-2 border-buzz-coral bg-buzz-paper px-8 py-4 text-base font-bold text-buzz-coral shadow-sm transition hover:bg-buzz-coral hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        <img src={instagramIcon} alt="" className="h-5 w-5" />
        {status === "authenticating" ? "Logging in..." : "Login with Instagram"}
      </button>
    </div>
  );
}
