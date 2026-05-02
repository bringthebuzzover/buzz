/**
 * Single-page org profile capture used on `/register`: org name, school, .edu email, and Instagram handle.
 * Submit is client-side only (demo alert) then navigation to `/campaigns`.
 */
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

export default function RegisterForm() {
  const navigate = useNavigate();

  /** Blocks native submit, shows a demo alert, then routes to `/campaigns`. */
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Profile registered! You can now apply to campaigns.");
    navigate("/campaigns");
  };

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="rounded-xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              Organization Name
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Babson Sigma Kappa"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              College/University Name
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Babson College"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              School Email (.edu)
            </label>
            <input
              required
              type="email"
              placeholder="you@babson.edu"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
            <p className="mt-1 text-xs font-medium text-buzz-inkFaint">
              Must be an active .edu email for verification.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              Organization Instagram Handle
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 font-medium text-buzz-inkFaint">
                @
              </span>
              <input
                required
                type="text"
                placeholder="babsonsigmakappa"
                className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 pl-8 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
              />
            </div>
            <p className="mt-1 text-xs font-medium text-buzz-inkFaint">
              Brands will preview this to select you for campaigns.
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-buzz-coral py-4 text-lg font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
      >
        Create Profile
      </button>
      <p className="mt-4 text-center text-xs font-medium text-buzz-inkMuted">
        By registering, you confirm you are an authorized representative of the
        campus group.
      </p>
    </form>
  );
}
