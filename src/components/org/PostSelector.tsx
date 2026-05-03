/**
 * Post selector for an active campaign. Lists the org's social posts and lets the
 * user toggle which ones are linked to this campaign. Enforces the
 * one-post-one-campaign rule — posts already linked to a different campaign show
 * a disabled checkbox with a reason chip.
 */
import { Camera, Music2 } from "lucide-react";
import {
  useLinks,
  useMockData,
  usePostsForOrg,
} from "../../contexts/MockDataContext";
import { canAssignPostToCampaign } from "../../utils/postAttribution";
import type { SocialPost } from "../../types/socialPost";
import { DEMO_ORG_ID } from "../../data/seed/seedOrgs";

type PostSelectorProps = {
  applicationId: string;
  dropId: string;
};

function PlatformIcon({ post }: { post: SocialPost }) {
  if (post.platform === "instagram") {
    return <Camera size={16} className="text-buzz-coral" />;
  }
  return <Music2 size={16} className="text-buzz-coral" />;
}

export default function PostSelector({
  applicationId,
  dropId,
}: PostSelectorProps) {
  const posts = usePostsForOrg(DEMO_ORG_ID);
  const links = useLinks();
  const { linkPostToCampaign, unlinkPost } = useMockData();

  return (
    <div className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-buzz-ink">Linked posts</h3>
        <p className="text-xs font-medium text-buzz-inkMuted">
          One post can only belong to one campaign.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-buzz-lineMid bg-buzz-cream p-6 text-center text-sm font-medium text-buzz-inkMuted">
          No posts found for your account yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const existing = links.find((l) => l.postId === post.id);
            const linkedHere = existing?.applicationId === applicationId;
            const conflict =
              existing && existing.applicationId !== applicationId;

            const onToggle = () => {
              if (linkedHere) {
                unlinkPost(post.id);
                return;
              }
              const result = canAssignPostToCampaign(
                post.id,
                applicationId,
                links
              );
              if (!result.allowed) return;
              linkPostToCampaign({
                postId: post.id,
                applicationId,
                dropId,
              });
            };

            return (
              <li
                key={post.id}
                className="flex items-start gap-4 rounded-xl border border-buzz-lineMid bg-buzz-cream p-4"
              >
                <input
                  type="checkbox"
                  checked={linkedHere}
                  disabled={Boolean(conflict)}
                  onChange={onToggle}
                  className="mt-1 h-4 w-4 cursor-pointer accent-buzz-coral disabled:cursor-not-allowed"
                  aria-label={`Link post ${post.caption}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <PlatformIcon post={post} />
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-bold text-buzz-coral hover:underline"
                    >
                      {post.caption}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-buzz-inkMuted">
                    <span>{post.metrics.likes.toLocaleString()} likes</span>
                    <span>
                      {post.metrics.comments.toLocaleString()} comments
                    </span>
                  </div>
                  {conflict ? (
                    <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Linked to another campaign
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
