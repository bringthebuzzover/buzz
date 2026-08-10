import type { NavigateFunction } from "react-router-dom";

/** Router `location.state` — Home clears after scrolling. */
export type HomeLocationState = { scrollToJoin?: boolean };

/** Smooth-scrolls to the public home Join Us anchor (below the fold). */
export function scrollToHomeJoin(): void {
  document.getElementById("home-join")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/** From any route: go home and scroll to Join Us, or scroll if already on `/`. */
export function goToHomeJoin(
  pathname: string,
  navigate: NavigateFunction,
): void {
  if (pathname === "/") {
    scrollToHomeJoin();
    return;
  }
  navigate("/", { state: { scrollToJoin: true } satisfies HomeLocationState });
}
