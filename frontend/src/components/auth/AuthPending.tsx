/**
 * Full-page session check. The bee appears after 300ms so a fast bootstrap
 * never flashes it. The node itself mounts immediately so callers can wait
 * on `data-testid="auth-pending"` until the role is known.
 */
import { useEffect, useState } from "react";
import { Loader } from "../ui/EmptyState";

export default function AuthPending({
  label = "Loading…",
}: {
  label?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      data-testid="auth-pending"
      role="status"
      aria-live="polite"
      aria-label={label}
      className="fixed inset-0 z-buzzBanner flex items-center justify-center bg-page"
    >
      {show ? <Loader label={label} /> : null}
    </div>
  );
}
