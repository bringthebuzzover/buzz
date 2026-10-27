/**
 * Shell for the `/pulse2` concept. Isolated from /pulse. Isolated from SiteLayout and /inspo.
 */
import { useEffect, useRef } from "react";
import { Link, Outlet } from "react-router-dom";
import PulseTwoFooter from "../components/pulse2/PulseTwoFooter";
import PulseTwoNav from "../components/pulse2/PulseTwoNav";
import { usePulseTwoMotion } from "../components/pulse2/usePulseTwoMotion";
import "../pages/pulse2/pulse2.css";

export default function PulseTwoLayout() {
  const rootRef = useRef<HTMLDivElement>(null);
  usePulseTwoMotion(rootRef);

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
      <PulseTwoNav />
      <main id="pulse2-content">
        <Outlet />
      </main>
      <PulseTwoFooter />
      <div className="pulse2-dock">
        <Link className="pulse2-pill" to="/org/apply">
          Join as a student organization
        </Link>
      </div>
    </div>
  );
}
