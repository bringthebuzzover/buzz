import { Link } from "react-router-dom";
import { useState } from "react";
import "./navbar.css";
import buzzLogo from "../../assets/buzz-logo.png";
import instaIcon from "../../assets/insta-icon.png";
import linkedinIcon from "../../assets/linkedin-icon.png";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="navbar">
        {/* top white strip */}
        <div className="navbar-top">
          <div className="socials">
            <a
              href="https://www.instagram.com/bringthebuzzover/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={instaIcon} alt="Instagram" />
            </a>
            <a
              href="https://www.linkedin.com/in/melissachowdhury/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={linkedinIcon} alt="LinkedIn" className="linkedin-icon" />
            </a>
          </div>

          <div className="waitlist-top">JOIN THE WAITLIST</div>
          <div className="profile"></div>
        </div>

        {/* pink bar */}
        <div className="navbar-main">
          {/* LEFT NAV (desktop only) */}
          <nav className="desktop-nav">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>

          {/* LOGO */}
          <div className="logo-wrapper">
            <img src={buzzLogo} alt="BUZZ" />
          </div>

          {/* RIGHT NAV (desktop only) */}
          <nav className="desktop-nav">
            <Link to="/contact">Contact</Link>
            <Link to="/waitlist">Waitlist</Link>
          </nav>

          {/* HAMBURGER (mobile only) */}
          <button
            className={`hamburger ${open ? "active" : ""}`}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      <nav className={`mobile-menu ${open ? "open" : ""}`}>
        <Link to="/" onClick={() => setOpen(false)}>Home</Link>
        <Link to="/about" onClick={() => setOpen(false)}>About</Link>
        <Link to="/contact" onClick={() => setOpen(false)}>Contact</Link>
        <Link to="/waitlist" onClick={() => setOpen(false)}>Waitlist</Link>
      </nav>
    </>
  );
}
