/** Router `location.state` — Home clears after scrolling. */
export type HomeLocationState = { scrollToJoin?: boolean };

/** Smooth-scrolls to the public home Join Us anchor (below the fold). */
export function scrollToHomeJoin(): void {
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("home-join")?.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: "start",
  });
}
