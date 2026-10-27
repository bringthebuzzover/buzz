/**
 * Floating glass bar modeled on oros.markets, in yellow and black.
 * It stays put, flips tone with the surface under it, and grows a soft
 * shadow over the first 480px of scroll.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { setPulseTwoScrollLocked } from "./usePulseTwoMotion";

const LINKS = [
  { href: "#students", label: "Organizations" },
  { href: "#brands", label: "Brands" },
  { href: "#how", label: "How it works" },
  { href: "/login", label: "Login" },
] as const;

const SECTION_IDS = ["how", "students", "brands"] as const;

function useMaxWidth(px: number): boolean {
  const query = `(max-width: ${px}px)`;
  const [match, setMatch] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(query);
    const apply = () => setMatch(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);

  return match;
}

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export default function PulseTwoNav() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isMobile = useMaxWidth(900);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setPulseTwoScrollLocked(true);
    const first = headerRef.current?.querySelector<HTMLElement>(".pulse2-nav__links a");
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      document.body.style.overflow = previousOverflow;
      setPulseTwoScrollLocked(false);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;
    const glow = header.querySelector<HTMLElement>(".pulse2-nav__glow");
    let frame = 0;

    const apply = () => {
      frame = 0;
      const rect = header.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = 8 + rect.height / 2;
      const stack = document.elementsFromPoint(x, y);
      const dark = stack.some((node) => {
        if (!(node instanceof Element) || header.contains(node)) return false;
        return Boolean(node.closest("[data-surface='dark']"));
      });
      header.dataset.tone = dark ? "contrast" : "default";
      if (glow) glow.style.opacity = String(smoothstep(window.scrollY / 480));

      const line = window.scrollY + rect.bottom;
      let active = "";
      SECTION_IDS.forEach((id) => {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= line) active = `#${id}`;
      });
      setCurrent(active);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const close = () => setOpen(false);

  return (
    <header ref={headerRef} className="pulse2-nav" data-tone="contrast">
      <span className="pulse2-nav__glow" aria-hidden="true" />
      <div className="pulse2-nav__inner">
        <Link to="/pulse2" className="pulse2-nav__brand" onClick={close}>
          <img
            className="pulse2-nav__mark"
            src={siteIdentity.images.logo}
            alt={siteIdentity.images.logoAlt}
          />
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className="pulse2-nav__menu"
          aria-expanded={open}
          aria-controls="pulse2-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <nav
          id="pulse2-menu"
          className="pulse2-nav__links"
          aria-label="Pulse"
          data-open={open ? "true" : "false"}
          data-lenis-prevent=""
          hidden={isMobile && !open}
        >
          {LINKS.map((link) => {
            const currentProps =
              link.href === current ? ({ "aria-current": "page" } as const) : {};
            return link.href.startsWith("/") ? (
              <Link key={link.href} to={link.href} onClick={close} {...currentProps}>
                <span className="pulse2-nav__label">{link.label}</span>
              </Link>
            ) : (
              <a key={link.href} href={link.href} onClick={close} {...currentProps}>
                <span className="pulse2-nav__label">{link.label}</span>
              </a>
            );
          })}
          <Link className="pulse2-pill pulse2-nav__cta" to="/org/apply" onClick={close}>
            Join
          </Link>
        </nav>
      </div>
    </header>
  );
}
