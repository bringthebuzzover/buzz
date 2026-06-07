/**
 * API-path post selector for an active campaign (Stage 7 strangler).
 *
 * Mirrors the demo `PostSelector` but is backed by the real API: lists the
 * org's posts (`useOrgPosts`), links/unlinks them to this campaign, and surfaces
 * auto-link suggestions with accept/dismiss. Enforces one-post-one-campaign by
 * disabling posts already linked to a different campaign.
 *
 * `readOnly` (finished campaigns) hides all mutating affordances.
 */
import { Camera, Music2 } from "lucide-react";
import {
  useAcceptSuggestion,
  useDismissSuggestion,
  useLinkPost,
  useOrgPosts,
  useSuggestions,
  useUnlinkPost,
  type PostItem,
  type Suggestion,
} from "../../api/hooks/useOrgHooks";

type Props = {
  applicationId: string;
  readOnly?: boolean;
};

function PlatformIcon({ platform }: { platform: string }) {
  return platform === "instagram" ? (
    <Camera size={16} className="text-buzz-coral" />
  ) : (
    <Music2 size={16} className="text-buzz-coral" />
  );
}

export default function ApiPostSelector({ applicationId, readOnly = false }: Props) {
  const { data: posts, isLoading } = useOrgPosts();
  const { data: suggestions } = useSuggestions(applicationId);
  const link = useLinkPost(applicationId);
  const unlink = useUnlinkPost(applicationId);
  const accept = useAcceptSuggestion(applicationId);
  const dismiss = useDismissSuggestion(applicationId);

  const busy =
    link.isPending || unlink.isPending || accept.isPending || dismiss.isPending;
  // Surface link/unlink/accept/dismiss failures (F8) — don't silently re-enable
  // the buttons leaving the user thinking the action worked.
  const mutationError = (link.error ||
    unlink.error ||
    accept.error ||
    dismiss.error) as Error | null;

  return (
    <div className="space-y-6">
      {mutationError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-700">
          {mutationError.message || "Something went wrong. Please try again."}
        </p>
      ) : null}
      {!readOnly && suggestions && suggestions.length > 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-6 shadow-sm">
          <h3 className="mb-1 text-lg font-bold text-buzz-ink">Suggested posts</h3>
          <p className="mb-4 text-xs font-medium text-buzz-inkMuted">
            We spotted these posts that look like they belong to this campaign.
          </p>
          <ul className="space-y-3">
            {suggestions.map((s: Suggestion) => (
              <li
                key={s.postId}
                className="flex items-center justify-between gap-3 rounded-xl border border-buzz-lineMid bg-buzz-cream p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-buzz-ink">
                    {s.caption || "(no caption)"}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-buzz-inkMuted">
                    {s.matchReason.replace(/_/g, " ")} · {s.likes} likes
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => accept.mutate(s.postId)}
                    className="rounded-lg bg-buzz-coral px-3 py-1.5 text-xs font-bold text-buzz-paper transition hover:bg-buzz-coralDark disabled:opacity-60"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => dismiss.mutate(s.postId)}
                    className="rounded-lg border border-buzz-lineMid px-3 py-1.5 text-xs font-bold text-buzz-inkMuted transition hover:bg-buzz-paper disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-buzz-ink">Linked posts</h3>
          <p className="text-xs font-medium text-buzz-inkMuted">
            One post can only belong to one campaign.
          </p>
        </div>

        {isLoading ? (
          <p className="rounded-xl border border-dashed border-buzz-lineMid bg-buzz-cream p-6 text-center text-sm font-medium text-buzz-inkMuted">
            Loading your posts…
          </p>
        ) : !posts || posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-buzz-lineMid bg-buzz-cream p-6 text-center text-sm font-medium text-buzz-inkMuted">
            No posts found for your account yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post: PostItem) => {
              const linkedHere = post.linkedApplicationId === applicationId;
              const conflict =
                post.linkedApplicationId != null && !linkedHere;
              return (
                <li
                  key={post.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-buzz-lineMid bg-buzz-cream p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PlatformIcon platform={post.platform} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-buzz-ink">
                        {post.caption || "(no caption)"}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-buzz-inkMuted">
                        {post.likes} likes · {post.comments} comments
                      </p>
                    </div>
                  </div>
                  {readOnly ? (
                    linkedHere ? (
                      <span className="shrink-0 text-xs font-bold text-buzz-coral">
                        Linked
                      </span>
                    ) : null
                  ) : conflict ? (
                    <span className="shrink-0 rounded-lg border border-buzz-lineMid px-3 py-1.5 text-[11px] font-bold text-buzz-inkMuted">
                      Linked to another campaign
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        linkedHere
                          ? unlink.mutate(post.id)
                          : link.mutate(post.id)
                      }
                      className={
                        linkedHere
                          ? "shrink-0 rounded-lg border border-buzz-coral px-3 py-1.5 text-xs font-bold text-buzz-coral transition hover:bg-buzz-cream disabled:opacity-60"
                          : "shrink-0 rounded-lg bg-buzz-coral px-3 py-1.5 text-xs font-bold text-buzz-paper transition hover:bg-buzz-coralDark disabled:opacity-60"
                      }
                    >
                      {linkedHere ? "Unlink" : "Link"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
