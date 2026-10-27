/**
 * Shell for the `/pulse` yellow/black concept. Isolated from SiteLayout and
 * from the parked `/inspo` redesign.
 */
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PulseFooter from "../components/pulse/PulseFooter";
import PulseNav from "../components/pulse/PulseNav";
import "../pages/pulse/pulse.css";

export default function PulseLayout() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    const prevTitle = document.title;
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute("content") ?? null;

    document.title = "BUZZ — Pulse";
    document.body.style.backgroundColor = "#0a0a0a";
    document.documentElement.style.backgroundColor = "#0a0a0a";
    meta?.setAttribute("content", "#0a0a0a");

    return () => {
      document.title = prevTitle;
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
      if (prevTheme && meta) meta.setAttribute("content", prevTheme);
    };
  }, []);

  useEffect(() => {
    if (!hash) {
      try {
        window.scrollTo(0, 0);
      } catch {
        // jsdom implements scrollTo as a throwing stub.
      }
      return undefined;
    }
    const id = hash.slice(1);
    try {
      document.getElementById(id)?.scrollIntoView();
    } catch {
      // jsdom implements scrollIntoView as a throwing stub.
    }
    return undefined;
  }, [hash, pathname]);

  return (
    <div className="pulse">
      <a className="pulse-skip" href="#pulse-content">
        Skip to content
      </a>
      <PulseNav />
      <main id="pulse-content">
        <Outlet />
      </main>
      <PulseFooter />
    </div>
  );
}
