import { Link } from "react-router-dom";
import "./navbar.css";
import buzzLogo from "../../assets/buzz-logo.png";
import instaIcon from "../../assets/insta-icon.png";
import linkedinIcon from "../../assets/linkedin-icon.png";


export default function Navbar() {
  return (
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
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>

        <div className="logo-wrapper">
          <img src={buzzLogo} alt="BUZZ" />
        </div>

        <nav>
          <Link to="/contact">Contact</Link>
          <Link to="/waitlist">Waitlist</Link>
        </nav>
      </div>
    </header>
  );
}
