/**
 * Sends a creator to the one screen that matches their status. Every
 * `/creators/*` route sits behind this so a pending or denied creator can
 * never reach the feed, campaigns, or profile.
 */
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCreatorSession } from "../../api/hooks/creator/useCreatorHooks";
import type { CreatorStatus } from "../../api/hooks/creator/types";

function creatorHomePath(status: CreatorStatus | null): string {
  switch (status) {
    case null:
      return "/creators/apply";
    case "pending_email":
      return "/creators/verify";
    case "pending_review":
    case "denied":
      return "/creators/pending";
    case "pending_instagram":
      return "/creators/connect";
    case "active":
      return "/creators/feed";
  }
}

export default function CreatorStatusGate({
  allow,
  children,
}: {
  allow: readonly (CreatorStatus | null)[];
  children?: ReactNode;
}) {
  const { data } = useCreatorSession();
  if (!allow.includes(data.status)) {
    return <Navigate to={creatorHomePath(data.status)} replace />;
  }
  return <>{children}</>;
}
