/**
 * /admin — the impersonation console: every org + brand account with a
 * "View as" action.
 *
 * "View as" swaps the in-memory bearer for a short-lived impersonation token
 * and navigates into that user's portal. The query cache is cleared first so
 * the target never sees data fetched as the admin (or a previous target).
 */
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import {
  useAdminUsers,
  useImpersonate,
  type AdminUserRow,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import { pathForUser } from "../../utils/landing";
import { useState } from "react";

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${
        active
          ? "border-green-300 bg-green-50 text-green-800"
          : "border-buzz-lineMid bg-buzz-cream text-buzz-inkMuted"
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminUsersPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const users = useAdminUsers();
  const impersonate = useImpersonate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const expired = searchParams.get("impersonation") === "expired";

  const viewAs = async (row: AdminUserRow) => {
    setError(null);
    try {
      await impersonate.mutateAsync(row.id);
      // Drop everything fetched as the admin before rendering the target's
      // portal, otherwise stale cache entries leak across the identity switch.
      queryClient.clear();
      const me = await refreshUser();
      navigate(me ? pathForUser(me) : "/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start impersonation.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-16">
      <h1 className="mb-2 text-3xl font-bold text-buzz-ink">
        Admin <span className="text-buzz-coral">Console</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        View the product as any active organization or brand account.
      </p>

      {expired && (
        <p className="mb-6 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800">
          That impersonation session expired. Start a new one below.
        </p>
      )}

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {users.isPending && (
        <p className="text-sm font-medium text-buzz-inkMuted">Loading users…</p>
      )}

      {users.isError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          Could not load users.
        </p>
      )}

      {users.data && (
        <div className="overflow-x-auto rounded-lg border border-buzz-lineMid">
          <table className="w-full text-left text-sm">
            <thead className="bg-buzz-cream text-xs uppercase tracking-wide text-buzz-inkMuted">
              <tr>
                <th className="px-4 py-3 font-bold">Account</th>
                <th className="px-4 py-3 font-bold">Role</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.data.map((row: AdminUserRow) => (
                <tr
                  key={row.id}
                  className="border-t border-buzz-lineMid align-middle"
                >
                  <td className="px-4 py-3 font-semibold text-buzz-ink">
                    {row.displayName ?? "—"}
                    {row.instagramHandle && (
                      <span className="ml-2 text-xs font-medium text-buzz-inkMuted">
                        @{row.instagramHandle.replace(/^@/, "")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-buzz-inkMuted">
                    {row.portalRole}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-buzz-inkMuted">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      data-testid={`view-as-${row.id}`}
                      disabled={!row.impersonatable || impersonate.isPending}
                      onClick={() => void viewAs(row)}
                      className="rounded-lg border-2 border-buzz-coral px-4 py-2 text-xs font-bold text-buzz-coral transition enabled:hover:bg-buzz-coral enabled:hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      View as
                    </button>
                  </td>
                </tr>
              ))}
              {users.data.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm font-medium text-buzz-inkMuted"
                  >
                    No org or brand accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
