import { useOrgProfile } from "../../api/hooks/useOrgHooks";
import { Notice } from "../forms/controls";

export default function IgPreviousAccountBanner() {
  const { data } = useOrgProfile();
  if (!data?.igSwitchedAt || !data.previousInstagramHandle) return null;
  const when = new Date(data.igSwitchedAt).toLocaleDateString();
  return (
    <Notice>
      Some linked posts are from a previous Instagram account (@
      {data.previousInstagramHandle}, switched {when}). Last-known metrics on those posts
      stay; new posts come from the account you use now.
    </Notice>
  );
}
