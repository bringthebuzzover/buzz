/**
 * Creator portal shapes. These mirror what the creator API will return so
 * pages only change their hook imports when the backend lands.
 */

export type CreatorStatus =
  | "pending_email"
  | "pending_review"
  | "pending_instagram"
  | "active"
  | "denied";

export type PortfolioItem = {
  id: string;
  title: string;
  format: string;
  source: "connected" | "supplied";
  link: string | null;
  imageUrl: string | null;
};

export type CreatorProfile = {
  id: string;
  name: string;
  school: string;
  city: string;
  gradYear: string;
  eduEmail: string;
  /** Typed at apply; bound for real at Connect Instagram. */
  claimedHandle: string;
  instagramConnected: boolean;
  followers: number | null;
  posts: number | null;
  niches: string[];
  bio: string;
  tiktokHandle: string;
  openTo: string[];
  pastCollab: string | null;
  portfolio: PortfolioItem[];
  status: CreatorStatus;
};

export type CreatorApplyInput = Pick<
  CreatorProfile,
  | "name"
  | "school"
  | "city"
  | "gradYear"
  | "eduEmail"
  | "claimedHandle"
  | "niches"
  | "bio"
  | "tiktokHandle"
  | "openTo"
>;

export type CreatorDropStatus = "upcoming" | "open" | "closed";

export type CreatorDrop = {
  id: string;
  title: string;
  brandName: string;
  description: string;
  imageUrl: string | null;
  status: CreatorDropStatus;
  /** Apply window still running; batch finalize waits for it to end. */
  windowOpen: boolean;
  creatorCap: number;
  acceptedCount: number;
  creatorGross: number;
  buzzFee: number;
  brandTotal: number;
};

export type CreatorDecision = "applied" | "accepted" | "denied";
export type CreatorContentState = "none" | "in_review" | "accepted";
export type CreatorPayoutState = "not_recorded" | "recorded";

export type CreatorApplication = {
  id: string;
  dropId: string;
  creatorId: string;
  pitch: string;
  decision: CreatorDecision;
  content: CreatorContentState;
  linkedPostId: string | null;
  payout: CreatorPayoutState;
};

/** A post from the creator's connected Instagram. */
export type CreatorPost = {
  id: string;
  caption: string;
  format: "Reel" | "Post";
  postedAt: string;
};

export type CreatorEarnings = {
  paid: number;
  pending: number;
  yearToDate: number;
};

export type CreatorCampaign = {
  application: CreatorApplication;
  drop: CreatorDrop;
  linkedPost: CreatorPost | null;
};

export type CreatorRosterRow = {
  application: CreatorApplication;
  creator: CreatorProfile;
  linkedPost: CreatorPost | null;
};

export type CreatorPayoutRow = {
  application: CreatorApplication;
  creator: CreatorProfile;
  drop: CreatorDrop;
};
