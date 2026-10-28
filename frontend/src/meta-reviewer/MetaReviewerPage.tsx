/**
 * META-REVIEWER-PATH: reusable reviewer entry. The secret lives in the URL
 * fragment (`/meta-review#...`) so it is not sent to our server as a path
 * or query, and it is not included in a Referer. Delete this file with the
 * route hook in AppRoot. See backend/app/meta_reviewer/REMOVAL.md.
 */
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api/config";
import AuthShell from "../components/site/AuthShell";
import NotFoundPage from "../pages/NotFoundPage";
import { TEXT } from "../theme/tokens";
import { cn } from "../theme/cn";
import { isInstagramAuthorizeUrl } from "./instagramAuthorizeUrl";

type Phase = "working" | "gone" | "error";

function fragmentToken(): string {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export default function MetaReviewerPage() {
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = fragmentToken();
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!token) {
      setPhase("gone");
      return;
    }

    let cancelled = false;
    const start = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/meta-reviewer/start`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (resp.status === 404) {
          setPhase("gone");
          return;
        }
        if (resp.status === 429) {
          setPhase("error");
          setMessage("Too many attempts. Wait a minute and open the link again.");
          return;
        }
        if (!resp.ok) {
          setPhase("error");
          setMessage(
            resp.status === 401
              ? "This reviewer link is not valid."
              : "This reviewer link is not ready. Ask Buzz to finish setup.",
          );
          return;
        }
        const body = (await resp.json()) as {
          data?: { authorize_url?: string; authorizeUrl?: string };
        };
        const authorize = body.data?.authorizeUrl ?? body.data?.authorize_url ?? "";
        if (!isInstagramAuthorizeUrl(authorize)) {
          setPhase("error");
          setMessage("Instagram did not return a connect link.");
          return;
        }
        window.location.assign(authorize);
      } catch {
        if (!cancelled) {
          setPhase("error");
          setMessage("Could not reach Buzz. Try the link again.");
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "gone") return <NotFoundPage />;
  if (phase === "working") return null;
  return (
    <AuthShell align="center" className="text-center">
      <h1 className={cn(TEXT.h1, "mb-4")}>Link not available</h1>
      <p className="text-sm font-medium text-buzz-inkMuted">{message}</p>
    </AuthShell>
  );
}
