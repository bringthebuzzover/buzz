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
  useRefreshOrgPosts,
  useSuggestions,
  useUnlinkPost,
  type PostItem,
  type Suggestion,
} from "../../api/hooks/useOrgHooks";
import { Button, ErrorBanner } from "../forms/controls";
import { Card, CardHeader } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { StatePanel } from "../ui/StatePanel";
import { PAD, STACK, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

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
  const refreshPosts = useRefreshOrgPosts();
  const { data: suggestions } = useSuggestions(applicationId);
  const link = useLinkPost(applicationId);
  const unlink = useUnlinkPost(applicationId);
  const accept = useAcceptSuggestion(applicationId);
  const dismiss = useDismissSuggestion(applicationId);

  const busy =
    link.isPending ||
    unlink.isPending ||
    accept.isPending ||
    dismiss.isPending ||
    refreshPosts.isPending;
  // Surface link/unlink/accept/dismiss failures (F8) — don't silently re-enable
  // the buttons leaving the user thinking the action worked.
  const mutationError = (link.error ||
    unlink.error ||
    accept.error ||
    dismiss.error) as Error | null;

  return (
    <div className={STACK.group}>
      {mutationError ? (
        <ErrorBanner>
          {mutationError.message || "Something went wrong. Please try again."}
        </ErrorBanner>
      ) : null}
      {!readOnly && suggestions && suggestions.length > 0 ? (
        <Card kind="card" pad="card">
          <CardHeader
            title="Suggested posts"
            description="We spotted these posts that look like they belong to this campaign."
          />
          <ul className={STACK.tight}>
            {suggestions.map((s: Suggestion) => (
              <li
                key={s.postId}
                className={cn(
                  SURFACE.inset,
                  PAD.tight,
                  "flex items-center justify-between gap-3",
                )}
              >
                <div className="min-w-0">
                  <p className={cn(TEXT.body, "truncate font-medium text-buzz-ink")}>
                    {s.caption || "(no caption)"}
                  </p>
                  <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>
                    {s.matchReason.replace(/_/g, " ")} · {s.likes} likes
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="compact"
                    disabled={busy}
                    onClick={() => accept.mutate(s.postId)}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    size="compact"
                    variant="outline"
                    disabled={busy}
                    onClick={() => dismiss.mutate(s.postId)}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card kind="card" pad="card">
        <CardHeader
          title="Linked posts"
          description="One post can only belong to one campaign."
          actions={
            <Button
              type="button"
              size="compact"
              variant="outline"
              disabled={busy}
              onClick={() => refreshPosts.mutate()}
              title="Reload the posts Buzz already synced — does not fetch from Instagram"
            >
              {refreshPosts.isPending ? "Reloading…" : "Show latest synced posts"}
            </Button>
          }
        />

        {isLoading ? (
          <StatePanel>Loading your posts…</StatePanel>
        ) : !posts || posts.length === 0 ? (
          <StatePanel>No posts found for your account yet.</StatePanel>
        ) : (
          <ul className={STACK.tight}>
            {posts.map((post: PostItem) => {
              const linkedHere = post.linkedApplicationId === applicationId;
              const conflict =
                post.linkedApplicationId != null && !linkedHere;
              return (
                <li
                  key={post.id}
                  className={cn(
                    SURFACE.inset,
                    PAD.tight,
                    "flex items-center justify-between gap-3",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PlatformIcon platform={post.platform} />
                    <div className="min-w-0">
                      <p className={cn(TEXT.body, "truncate font-medium text-buzz-ink")}>
                        {post.caption || "(no caption)"}
                      </p>
                      <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>
                        {post.likes} likes · {post.comments} comments
                      </p>
                    </div>
                  </div>
                  {readOnly ? (
                    linkedHere ? (
                      <span className={cn(TEXT.meta, "shrink-0 font-semibold text-buzz-coral")}>
                        Linked
                      </span>
                    ) : null
                  ) : conflict ? (
                    <Chip>Linked to another campaign</Chip>
                  ) : (
                    <Button
                      type="button"
                      size="compact"
                      variant={linkedHere ? "outline" : "primary"}
                      disabled={busy}
                      onClick={() =>
                        linkedHere
                          ? unlink.mutate(post.id)
                          : link.mutate(post.id)
                      }
                    >
                      {linkedHere ? "Unlink" : "Link"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
