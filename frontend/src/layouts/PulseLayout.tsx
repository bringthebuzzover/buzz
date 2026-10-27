/**
 * Shell for the `/pulse` concept. Isolated from SiteLayout and /inspo.
 */
import { useEffect, useRef } from "react";
import { Link, Outlet } from "react-router-dom";
import PulseFooter from "../components/pulse/PulseFooter";
import PulseNav from "../components/pulse/PulseNav";
import { usePulseMotion } from "../components/pulse/usePulseMotion";
import "../pages/pulse/pulse.css";

export default function PulseLayout() {
  const rootRef = useRef<HTMLDivElement>(null);
  usePulseMotion(rootRef);

  useEffect(() => {
    const prevTitle = document.title;
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute("content") ?? null;

    document.title = "BUZZ — Pulse";
    document.body.style.backgroundColor = "#0b0b0b";
    document.documentElement.style.backgroundColor = "#0b0b0b";
    meta?.setAttribute("content", "#0b0b0b");

    return () => {
      document.title = prevTitle;
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
      if (prevTheme && meta) meta.setAttribute("content", prevTheme);
    };
  }, []);

  useEffect(() => {
    const dock = document.querySelector(".pulse-dock");
    const footer = document.querySelector(".pulse-footer");
    if (!dock || !footer || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        dock.classList.toggle("is-hidden", entry.isIntersecting);
      },
      { threshold: 0.12 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pulse" ref={rootRef}>
      <a className="pulse-skip" href="#pulse-content">
        Skip to content
      </a>
      <PulseNav />
      <main id="pulse-content">
        <Outlet />
      </main>
      <PulseFooter />
      <div className="pulse-dock">
        <Link className="pulse-pill" to="/org/apply">
          Join as a student organization
        </Link>
      </div>
    </div>
  );
}
