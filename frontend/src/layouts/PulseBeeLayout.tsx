/**
 * Shell for `/pulse-bee`. Copied from /pulse2 so that page stays frozen.
 * Isolated from /pulse, /pulse2, SiteLayout, and /inspo.
 */
import { useEffect, useRef } from "react";
import { Link, Outlet } from "react-router-dom";
import PulseBeeFooter from "../components/pulseBee/PulseBeeFooter";
import PulseBeeNav, { type PulseBeeNavProps } from "../components/pulseBee/PulseBeeNav";
import { usePulseBeeMotion } from "../components/pulseBee/usePulseBeeMotion";
import "../pages/pulseBee/pulseBee.css";

export type PulseBeeLayoutProps = {
  /** Nav overrides for the /pulse-bee/orgs and /pulse-bee/brands pages. */
  nav?: PulseBeeNavProps;
  /** Mobile dock pill. Defaults to the org apply link. */
  dock?: { href: string; label: string };
};

const DOCK = { href: "/org/apply", label: "Join as a student organization" };

export default function PulseBeeLayout({ nav, dock = DOCK }: PulseBeeLayoutProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePulseBeeMotion(rootRef);

  useEffect(() => {
    const prevTitle = document.title;
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute("content") ?? null;

    document.title = "BUZZ";
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
    const dock = document.querySelector(".pulse2-dock");
    const footer = document.querySelector(".pulse2-footer");
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
    <div className="pulse2" ref={rootRef}>
      <a className="pulse2-skip" href="#pulse2-content">
        Skip to content
      </a>
      <PulseBeeNav {...nav} />
      <main id="pulse2-content">
        <Outlet />
      </main>
      <PulseBeeFooter />
      <div className="pulse2-dock">
        <Link className="pulse2-pill" to={dock.href}>
          {dock.label}
        </Link>
      </div>
    </div>
  );
}
