/**
 * Linked posts card shows stored Instagram insights next to likes and comments.
 */
import { renderToString } from "react-dom/server";
import ApiPostSelector from "./ApiPostSelector";
import type { PostItem } from "../../api/hooks/useOrgHooks";
import { INSIGHT_MISSING } from "../posts/insightMetrics";

const APPLICATION_ID = "app-1";

function post(overrides: Partial<PostItem> = {}): PostItem {
  return {
    id: "post-1",
    orgId: "org-1",
    platform: "instagram",
    externalId: "ig-1",
    url: "https://instagram.com/p/example",
    mediaUrl: null,
    thumbnailUrl: null,
    caption: "Campus drop reel",
    mediaType: "VIDEO",
    mediaProductType: "REELS",
    postedAt: 1,
    likes: 820,
    comments: 53,
    reach: 4100,
    views: 12400,
    saved: 40,
    shares: 12,
    reposts: null,
    totalInteractions: 90,
    profileVisits: null,
    profileActivity: null,
    follows: null,
    igReelsAvgWatchTime: 1200,
    igReelsVideoViewTotalTime: 125000,
    reelsSkipRate: 18,
    metricsUpdatedAt: 1,
    createdAt: 1,
    linkedApplicationId: APPLICATION_ID,
    linkedDropId: "drop-1",
    ...overrides,
  };
}

const mockPosts = jest.fn();

jest.mock("../../api/hooks/useOrgHooks", () => ({
  useOrgPosts: () => mockPosts(),
  useRefreshOrgPosts: () => ({ mutate: jest.fn(), isPending: false }),
  useSuggestions: () => ({ data: [] }),
  useLinkPost: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useUnlinkPost: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useAcceptSuggestion: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useDismissSuggestion: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useOrgProfile: () => ({ data: undefined }),
}));


describe("ApiPostSelector insights", () => {
  it("shows reel insights on the linked post and an em dash when a metric is missing", () => {
    mockPosts.mockReturnValue({
      isLoading: false,
      data: [post({ views: null })],
    });
    const view = renderToString(
      <ApiPostSelector applicationId={APPLICATION_ID} readOnly />,
    );
    expect(view).toContain("Linked posts");
    expect(view).toContain("820 likes");
    expect(view).toContain("53 comments");
    expect(view).toContain("Instagram insights");
    expect(view).toContain("Reach");
    expect(view).toContain("4,100");
    expect(view).toContain("Saves");
    expect(view).toContain("Avg watch time");
    expect(view).toContain("1.2s");
    expect(view).toContain("Total watch time");
    expect(view).toContain("2m 5s");
    expect(view).toContain("Skip rate");
    expect(view).toContain("18%");
    expect(view).toContain(INSIGHT_MISSING);
    expect(view).not.toContain("Profile visits");
    expect(view).not.toContain("undefined");
    expect(view).not.toContain("NaN");
  });
});
