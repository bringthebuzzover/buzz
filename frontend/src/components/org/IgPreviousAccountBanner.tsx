import { useOrgProfile } from "../../api/hooks/useOrgHooks";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function IgPreviousAccountBanner() {
  const { data } = useOrgProfile();
  if (!data?.igSwitchedAt || !data.previousInstagramHandle) return null;
  const when = new Date(data.igSwitchedAt).toLocaleDateString();
  return (
    <p className={cn(TEXT.body, "rounded-buzzControl border border-buzz-warn/40 bg-buzz-warn/10 px-3 py-2")}>
      Some linked posts are from a previous Instagram account (@
      {data.previousInstagramHandle}, switched {when}). Last-known metrics on
      those posts stay; new posts come from the account you use now.
    </p>
  );
}
