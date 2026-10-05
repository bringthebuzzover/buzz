/**
 * In-memory creator backend for the frontend build. Owns every creator,
 * Drop, application, and post until the creator API exists; the hooks in
 * `useCreatorHooks.ts` are the only readers. Persists to sessionStorage so a
 * reload mid-journey keeps the viewer's status.
 */
import type {
  CreatorApplication,
  CreatorApplyInput,
  CreatorPost,
  CreatorProfile,
  CreatorStatus,
} from "./types";

const STORAGE_KEY = "buzz.creatorMock.v2";
const BUZZ_FEE_RATE = 0.2;

export type MockDrop = {
  id: string;
  title: string;
  brandName: string;
  description: string;
  imageUrl: string | null;
  upcoming: boolean;
  windowOpen: boolean;
  creatorCap: number;
  creatorGross: number;
};

export type MockState = {
  /** Set when an admin opened the portal from the demo directory. */
  demo: boolean;
  viewerId: string | null;
  creators: CreatorProfile[];
  drops: MockDrop[];
  applications: CreatorApplication[];
  posts: Record<string, CreatorPost[]>;
};

export const buzzFeeFor = (gross: number) => Math.round(gross * BUZZ_FEE_RATE);

function seedState(): MockState {
  return {
    demo: false,
    viewerId: null,
    creators: [
      {
        id: "creator-coco",
        name: "Coco Reyes",
        school: "UCLA",
        city: "Los Angeles",
        gradYear: "2027",
        eduEmail: "coco@ucla.edu",
        claimedHandle: "@cocoatucla",
        instagramConnected: false,
        followers: null,
        posts: null,
        niches: ["Fashion", "College lifestyle"],
        bio: "Thrift hauls and dorm style.",
        tiktokHandle: "",
        openTo: ["Flat fee"],
        pastCollab: null,
        portfolio: [],
        status: "pending_review",
      },
      {
        id: "creator-ivy",
        name: "Ivy Chen",
        school: "Cornell University",
        city: "Ithaca",
        gradYear: "2026",
        eduEmail: "ivy@cornell.edu",
        claimedHandle: "@ivyeats",
        instagramConnected: true,
        followers: 14800,
        posts: 412,
        niches: ["Food", "College lifestyle"],
        bio: "Cheap eats around campus.",
        tiktokHandle: "@ivyeats",
        openTo: ["Flat fee", "Long-term ambassador"],
        pastCollab: "Lindt",
        portfolio: [],
        status: "active",
      },
    ],
    drops: [
      {
        id: "drop-northline",
        title: "Fall ambassador week",
        brandName: "Northline",
        description: "Opens later this semester.",
        imageUrl: null,
        upcoming: true,
        windowOpen: false,
        creatorCap: 4,
        creatorGross: 300,
      },
      {
        id: "drop-update",
        title: "Finals Week Reel",
        brandName: "UPDATE",
        description:
          "Show how you get through finals week in a feed post or Reel from your own Instagram. Nothing ships.",
        imageUrl:
          "https://res.cloudinary.com/wffcoxs0/image/upload/f_auto,q_auto/UPDATE_x_BUZZ_600_x_400_px",
        upcoming: false,
        windowOpen: true,
        creatorCap: 2,
        creatorGross: 400,
      },
    ],
    applications: [
      {
        id: "app-ivy-update",
        dropId: "drop-update",
        creatorId: "creator-ivy",
        pitch: "A Reel of a late-night library run with my study group.",
        decision: "applied",
        content: "none",
        linkedPostId: null,
        payout: "not_recorded",
      },
    ],
    posts: {},
  };
}

function load(): MockState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    /* fall through to seed */
  }
  return seedState();
}

let state: MockState = load();
const listeners = new Set<() => void>();

function commit(next: MockState) {
  state = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked; keep in memory */
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getState = () => state;

export function resetCreatorMock() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  commit(seedState());
}

let nextId = 0;
const newId = (prefix: string) => `${prefix}-${Date.now()}-${(nextId += 1)}`;

const CONNECTED_STATS = { instagramConnected: true, followers: 11200, posts: 386 } as const;

function connectedPosts(): CreatorPost[] {
  return [
    {
      id: newId("post"),
      caption: "My finals week study routine",
      format: "Reel",
      postedAt: "2026-09-21",
    },
    {
      id: newId("post"),
      caption: "Move-in week, what I actually used",
      format: "Post",
      postedAt: "2026-09-02",
    },
  ];
}

/** Every creator state an admin can open from the demo directory. */
export type CreatorDemoScenario =
  | "guest"
  | "pending_email"
  | "pending_review"
  | "denied"
  | "pending_instagram"
  | "active"
  | "active_selected"
  | "active_campaign";

const DEMO_CREATOR_ID = "creator-demo";

function demoState(scenario: CreatorDemoScenario): MockState {
  const seed = { ...seedState(), demo: true };
  if (scenario === "guest") return seed;
  const onDrop = scenario === "active_selected" || scenario === "active_campaign";
  const active = scenario === "active" || onDrop;
  const posts = active ? connectedPosts() : [];
  const creator: CreatorProfile = {
    id: DEMO_CREATOR_ID,
    name: "Jacey Park",
    school: "Cornell University",
    city: "Ithaca",
    gradYear: "2027",
    eduEmail: "jacey@cornell.edu",
    claimedHandle: "@jaceystudies",
    instagramConnected: false,
    followers: null,
    posts: null,
    niches: ["College lifestyle", "Fitness"],
    bio: "Study routines and campus life at Cornell.",
    tiktokHandle: "",
    openTo: ["Flat fee"],
    pastCollab: null,
    portfolio: [],
    ...(active ? CONNECTED_STATS : {}),
    status: active ? "active" : scenario,
  };
  const linked = scenario === "active_campaign";
  const applications = onDrop
    ? [
        ...seed.applications,
        {
          id: "app-demo-update",
          dropId: "drop-update",
          creatorId: DEMO_CREATOR_ID,
          pitch: "A Reel of my finals week study routine.",
          decision: "accepted" as const,
          content: linked ? ("accepted" as const) : ("none" as const),
          linkedPostId: linked ? posts[0].id : null,
          payout: "not_recorded" as const,
        },
      ]
    : seed.applications;
  return {
    ...seed,
    viewerId: DEMO_CREATOR_ID,
    creators: [...seed.creators, creator],
    applications,
    posts: active ? { [DEMO_CREATOR_ID]: posts } : {},
  };
}

function patchCreator(id: string, patch: Partial<CreatorProfile>) {
  commit({
    ...state,
    creators: state.creators.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  });
}

function patchApplication(id: string, patch: Partial<CreatorApplication>) {
  commit({
    ...state,
    applications: state.applications.map((row) =>
      row.id === id ? { ...row, ...patch } : row,
    ),
  });
}

function viewer() {
  return state.creators.find((row) => row.id === state.viewerId) ?? null;
}

function setViewerStatus(from: CreatorStatus, to: CreatorStatus) {
  const current = viewer();
  if (current?.status === from) patchCreator(current.id, { status: to });
}

export const actions = {
  apply(input: CreatorApplyInput) {
    const id = newId("creator");
    commit({
      ...state,
      viewerId: id,
      creators: [
        ...state.creators,
        {
          ...input,
          id,
          instagramConnected: false,
          followers: null,
          posts: null,
          pastCollab: null,
          portfolio: [],
          status: "pending_email",
        },
      ],
    });
  },

  confirmEmail() {
    setViewerStatus("pending_email", "pending_review");
  },

  connectInstagram() {
    const current = viewer();
    if (current?.status !== "pending_instagram") return;
    commit({
      ...state,
      creators: state.creators.map((row) =>
        row.id === current.id
          ? { ...row, ...CONNECTED_STATS, status: "active" }
          : row,
      ),
      posts: { ...state.posts, [current.id]: connectedPosts() },
    });
  },

  addPortfolioItem(title: string, link: string) {
    const current = viewer();
    if (!current) return;
    patchCreator(current.id, {
      portfolio: [
        ...current.portfolio,
        {
          id: newId("portfolio"),
          title,
          format: "Past work",
          source: "supplied",
          link: link || null,
          imageUrl: null,
        },
      ],
    });
  },

  applyToDrop(dropId: string, pitch: string) {
    const current = viewer();
    if (current?.status !== "active") return;
    if (state.applications.some((row) => row.dropId === dropId && row.creatorId === current.id)) {
      return;
    }
    commit({
      ...state,
      applications: [
        ...state.applications,
        {
          id: newId("app"),
          dropId,
          creatorId: current.id,
          pitch,
          decision: "applied",
          content: "none",
          linkedPostId: null,
          payout: "not_recorded",
        },
      ],
    });
  },

  linkPost(applicationId: string, postId: string) {
    patchApplication(applicationId, { linkedPostId: postId, content: "in_review" });
  },

  signOut() {
    commit({ ...state, viewerId: null });
  },

  closeApplyWindow(dropId: string) {
    commit({
      ...state,
      drops: state.drops.map((row) => (row.id === dropId ? { ...row, windowOpen: false } : row)),
    });
  },

  finalize(dropId: string, acceptedIds: string[]) {
    const drop = state.drops.find((row) => row.id === dropId);
    if (!drop || drop.windowOpen) return;
    const alreadyAccepted = state.applications.filter(
      (row) => row.dropId === dropId && row.decision === "accepted",
    ).length;
    const seats = Math.max(0, drop.creatorCap - alreadyAccepted);
    const accepting = new Set(acceptedIds.slice(0, seats));
    commit({
      ...state,
      applications: state.applications.map((row) =>
        row.dropId === dropId && row.decision === "applied"
          ? { ...row, decision: accepting.has(row.id) ? "accepted" : "denied" }
          : row,
      ),
    });
  },

  acceptPost(applicationId: string) {
    patchApplication(applicationId, { content: "accepted" });
  },

  reviewCreator(creatorId: string, approve: boolean) {
    const creator = state.creators.find((row) => row.id === creatorId);
    if (creator?.status !== "pending_review") return;
    patchCreator(creatorId, { status: approve ? "pending_instagram" : "denied" });
  },

  recordPayout(applicationId: string) {
    patchApplication(applicationId, { payout: "recorded" });
  },

  startDemo(scenario: CreatorDemoScenario) {
    commit(demoState(scenario));
  },
};
