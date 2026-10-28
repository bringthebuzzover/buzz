/**
 * META-REVIEWER-PATH: admin control for the reviewer seed. Renders nothing
 * unless GET /api/meta-reviewer/status says the path is enabled (that route
 * 404s when the flag is off). Never shows the link secret. Delete with this
 * module; the overview hook is listed in backend/app/meta_reviewer/REMOVAL.md.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { components } from "../api/generated/schema";
import { Panel } from "../components/admin/AdminPrimitives";
import { Button, ErrorBanner, SuccessBanner } from "../components/forms/controls";

type ReviewerStatus = components["schemas"]["MetaReviewerStatusResponse"];
type ReviewerSeed = components["schemas"]["MetaReviewerSeedResponse"];

function seedResultCopy(result: ReviewerSeed): string {
  if (result.createdUser) return "Reviewer organization created.";
  if (result.createdApplication) return "Reviewer organization accepted on the drop.";
  return "Reviewer organization is already set up.";
}

export default function MetaReviewerAdminCard() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["meta-reviewer", "status"],
    retry: false,
    queryFn: async (): Promise<ReviewerStatus | null> => {
      try {
        const { data } = await apiFetch<ReviewerStatus>("/api/meta-reviewer/status");
        if (!data?.enabled) return null;
        return data;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
  const seed = useMutation({
    mutationFn: async () => {
      const { data } = await apiFetch<ReviewerSeed>("/api/meta-reviewer/seed", {
        method: "POST",
      });
      if (!data) {
        throw new ApiError("INTERNAL_ERROR", "Seed did not return a result.", 500);
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["meta-reviewer", "status"] });
    },
  });

  const hidden = status.isPending || (!status.isError && status.data == null);
  if (hidden) return null;

  const userId = seed.data?.userId ?? status.data?.userId ?? null;
  const dropId = seed.data?.dropId ?? status.data?.dropId ?? null;
  const seeded = status.data?.seeded === true || seed.isSuccess;
  const seedError =
    seed.error instanceof ApiError
      ? seed.error.message
      : seed.isError
        ? "Could not set up the reviewer organization."
        : null;
  const statusError =
    !seedError && status.isError
      ? status.error instanceof ApiError
        ? status.error.message
        : "Could not load reviewer status."
      : null;

  return (
    <div data-testid="meta-reviewer-admin">
      <Panel
        title="Meta App Review reviewer"
        description="Sets up the sandbox organization for App Review. This does not show the reviewer link."
      >
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm font-medium text-buzz-ink">{seeded ? "Set up." : "Not set up."}</p>
          {dropId ? (
            <p className="text-sm font-medium text-buzz-inkMuted">
              Drop{" "}
              <Link
                to={`/admin/drops/${dropId}`}
                className="font-semibold text-buzz-ink underline"
                data-testid="meta-reviewer-drop"
              >
                {dropId}
              </Link>
            </p>
          ) : (
            <p className="text-sm font-medium text-buzz-inkMuted">No drop configured.</p>
          )}
          {userId ? (
            <p>
              <Link
                to={`/admin/orgs/${userId}`}
                className="text-sm font-semibold text-buzz-coral underline"
                data-testid="meta-reviewer-org"
              >
                Open organization
              </Link>
            </p>
          ) : null}
          {seed.data ? <SuccessBanner>{seedResultCopy(seed.data)}</SuccessBanner> : null}
          {seedError ? <ErrorBanner>{seedError}</ErrorBanner> : null}
          {statusError ? <ErrorBanner>{statusError}</ErrorBanner> : null}
          <Button
            type="button"
            size="compact"
            data-testid="meta-reviewer-seed"
            disabled={seed.isPending}
            onClick={() => {
              seed.mutate();
            }}
          >
            Set up reviewer org
          </Button>
        </div>
      </Panel>
    </div>
  );
}
