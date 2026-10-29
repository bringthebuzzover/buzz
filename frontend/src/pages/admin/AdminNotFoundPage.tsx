/**
 * Unmatched /admin/* URL. Lives inside AdminLayout's bare chrome (slim header,
 * no sidebar) so it matches the admin 404 frame. The public splat keeps
 * NotFoundPage.
 */
import { BeeMark } from "../../components/ui/BrandMark";
import { LinkButton } from "../../components/forms/controls";
import { useAdminBareChrome } from "../../layouts/AdminLayout";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function AdminNotFoundPage() {
  useAdminBareChrome();
  return (
    <div className="flex max-w-xl flex-col items-center text-center">
      <h1 className={cn(TEXT.display, "text-accent")}>404</h1>
      <BeeMark className="mt-6 h-[120px] w-[120px]" />
      <p className={cn(TEXT.h3, "mt-6")}>This admin page does not exist.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <LinkButton to="/admin">Admin overview</LinkButton>
        <LinkButton to="/admin/login" variant="outline">
          Admin login
        </LinkButton>
      </div>
    </div>
  );
}
