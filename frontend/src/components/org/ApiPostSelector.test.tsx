/**
 * Linked posts card shows stored Instagram insights next to likes and comments.
 */
import { renderToString } from "react-dom/server";
import type { PostItem } from "../../api/hooks/useOrgHooks";
import { INSIGHT_MISSING } from "../posts/postInsights";

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

import ApiPostSelector from "./ApiPostSelector";

describe("ApiPostSelector insights", () => {
  it("shows reel insights on the linked post and an em dash when a metric is missing", () => {
    mockPosts.mockReturnValue({
      isLoading: false,
      data: [post({ views: null })],
    });
    const html = renderToString(
      <ApiPostSelector applicationId={APPLICATION_ID} readOnly />,
    );
    expect(html).toContain("Linked posts");
    expect(html).toContain("820 likes");
    expect(html).toContain("53 comments");
    expect(html).toContain("Instagram insights");
    expect(html).toContain("Reach");
    expect(html).toContain("4,100");
    expect(html).toContain("Saves");
    expect(html).toContain("Avg watch time");
    expect(html).toContain("1.2s");
    expect(html).toContain("Total watch time");
    expect(html).toContain("2m 5s");
    expect(html).toContain("Skip rate");
    expect(html).toContain("18%");
    expect(html).toContain(INSIGHT_MISSING);
    expect(html).not.toContain("Profile visits");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });
});
