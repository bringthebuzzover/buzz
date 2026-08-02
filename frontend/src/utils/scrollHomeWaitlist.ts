import type { NavigateFunction } from "react-router-dom";

/** Router `location.state` — Home clears after scrolling. */
export type HomeLocationState = { scrollToWaitlist?: boolean };

/** Smooth-scrolls to the public home waitlist anchor (below the fold). */
export function scrollToHomeWaitlist(): void {
  document.getElementById("home-waitlist")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/** From any route: go home and scroll to waitlist, or scroll if already on `/`. */
export function goToHomeWaitlist(
  pathname: string,
  navigate: NavigateFunction
): void {
  if (pathname === "/") {
    scrollToHomeWaitlist();
    return;
  }
  navigate("/", { state: { scrollToWaitlist: true } satisfies HomeLocationState });
}
