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
import IgPreviousAccountBanner from "./IgPreviousAccountBanner";
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
import PostInsights from "../posts/PostInsights";
import { formatInsightCount } from "../posts/postInsights";
import { Card, CardHeader } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Loader, EmptyState } from "../ui/EmptyState";
import { RemoteImage } from "../ui/RemoteImage";
import { PAD, SURFACE, TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

type Props = {
  applicationId: string;
  readOnly?: boolean;
};

/** Pen row and card actions: 36px pills. */
const pillClass = "h-9 px-4";

function PlatformIcon({ platform }: { platform: string }) {
  const Icon = platform === "instagram" ? Camera : Music2;
  return <Icon size={12} aria-hidden className="shrink-0" />;
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
    <div className="flex flex-col gap-10">
      {mutationError ? (
        <ErrorBanner>
          {mutationError.message || "Something went wrong. Please try again."}
        </ErrorBanner>
      ) : null}
      {!readOnly && suggestions && suggestions.length > 0 ? (
        <Card kind="panel" pad="card">
          <CardHeader
            className="mb-5"
            title="Suggested posts"
            description="We spotted these posts that look like they belong to this campaign."
          />
          <ul className="flex flex-col gap-3">
            {suggestions.map((s: Suggestion) => (
              <li
                key={s.postId}
                className="flex flex-wrap items-center gap-4 rounded-buzzField border border-buzz-yellowLine bg-accent-wash p-4"
              >
                <RemoteImage
                  src={s.thumbnailUrl}
                  label={s.caption || "Post"}
                  alt=""
                  fallback="placeholder"
                  className="h-14 w-14 shrink-0 rounded-buzzCard object-cover"
                />
                <div className="min-w-0 flex-1 basis-40">
                  <p className={cn(TEXT.body, "truncate font-medium text-primary")}>
                    {s.caption || "(no caption)"}
                  </p>
                  <p className="mt-1 text-xs text-quiet">
                    {s.matchReason.replace(/_/g, " ")} · {s.likes} likes
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={pillClass}
                    disabled={busy}
                    onClick={() => dismiss.mutate(s.postId)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    type="button"
                    className={pillClass}
                    disabled={busy}
                    onClick={() => accept.mutate(s.postId)}
                  >
                    Confirm
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <IgPreviousAccountBanner />
      <Card kind="panel" pad="card">
        <CardHeader
          className="mb-5"
          title="Linked posts"
          description="One post can only belong to one campaign."
          actions={
            <button
              type="button"
              disabled={busy}
              onClick={() => refreshPosts.mutate()}
              title="Reload the posts Buzz already synced — does not fetch from Instagram"
              className={cn(
                "text-sm text-muted transition hover:text-primary disabled:opacity-50",
                focusRingClass,
              )}
            >
              {refreshPosts.isPending ? "Reloading…" : "Show latest synced posts →"}
            </button>
          }
        />

        {isLoading ? (
          <Loader label="Loading your posts…" className="py-8" />
        ) : !posts || posts.length === 0 ? (
          <EmptyState title="No posts found for your account yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((post: PostItem) => {
              const linkedHere = post.linkedApplicationId === applicationId;
              const conflict = post.linkedApplicationId != null && !linkedHere;
              return (
                <li
                  key={post.id}
                  className={cn(
                    SURFACE.tile,
                    PAD.default,
                    "flex flex-wrap items-start gap-4",
                  )}
                >
                  <RemoteImage
                    src={post.thumbnailUrl ?? post.mediaUrl}
                    label={post.caption || "Post"}
                    alt=""
                    fallback="placeholder"
                    className="h-[120px] w-24 shrink-0 rounded-buzzCard object-cover"
                  />
                  <div className="min-w-0 flex-1 basis-56">
                    <p className={cn(TEXT.body, "line-clamp-2 font-medium text-primary")}>
                      {post.caption || "(no caption)"}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-quiet">
                      <PlatformIcon platform={post.platform} />
                      {`${formatInsightCount(post.likes)} likes · ${formatInsightCount(post.comments)} comments`}
                    </p>
                    <PostInsights post={post} />
                  </div>
                  {readOnly ? (
                    linkedHere ? (
                      <Chip dot className="shrink-0 text-primary">
                        Linked
                      </Chip>
                    ) : null
                  ) : conflict ? (
                    <Chip>Linked to another campaign</Chip>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className={pillClass}
                      disabled={busy}
                      onClick={() =>
                        linkedHere ? unlink.mutate(post.id) : link.mutate(post.id)
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
