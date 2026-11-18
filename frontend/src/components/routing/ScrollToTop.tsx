import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Automatically scrolls window to top on route change.
 * Prevents client-side navigation from retaining the scroll offset of the prior page.
 *
 * Marketing pages apply CSS `scroll-behavior: smooth` for in-page anchor jumps
 * (e.g. #how-it-works). During cross-route navigation, an active smooth scroll
 * or inherited behavior would animate or preserve scroll offsets. We temporarily
 * set inline `scrollBehavior = "auto"` on <html>, scroll to (0, 0) instantly,
 * and restore previous scroll behavior on the next frame.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    html.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    const raf = window.requestAnimationFrame(() => {
      html.style.scrollBehavior = previous;
    });

    return () => {
      window.cancelAnimationFrame(raf);
      html.style.scrollBehavior = previous;
    };
  }, [pathname]);

  return null;
}
