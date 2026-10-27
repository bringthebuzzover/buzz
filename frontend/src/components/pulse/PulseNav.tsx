/**
 * Fixed bar for the Pulse concept. Desktop links from 768px; a full-height
 * menu below that, same destinations.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";

const LINKS = [
  { href: "#students", label: "Students" },
  { href: "#brands", label: "Brands" },
  { href: "#how", label: "How it works" },
  { href: "#contact", label: "Contact" },
] as const;

export default function PulseNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="pulse-nav">
      <div className="pulse-wrap pulse-nav__bar">
        <Link to="/pulse" className="pulse-nav__brand" onClick={() => setOpen(false)}>
          <img
            src={siteIdentity.images.logo}
            alt={siteIdentity.images.logoAlt}
            className="pulse-nav__logo"
          />
          <span className="pulse-nav__concept">Concept</span>
        </Link>

        <nav className="pulse-nav__links" aria-label="Pulse">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <a className="pulse-btn pulse-btn--yellow" href="#join">
            Join
          </a>
        </nav>

        <button
          type="button"
          className="pulse-nav__toggle"
          aria-expanded={open}
          aria-controls="pulse-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <nav id="pulse-menu" className="pulse-nav__panel" aria-label="Pulse" hidden={!open}>
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </a>
        ))}
        <a className="pulse-btn pulse-btn--yellow" href="#join" onClick={() => setOpen(false)}>
          Join
        </a>
      </nav>
    </header>
  );
}
