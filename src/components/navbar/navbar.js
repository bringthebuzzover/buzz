import { Link } from "react-router-dom";
import "./navbar.css";
import buzzLogo from "../../assets/buzz-logo.png";

export default function Navbar() {
  return (
    <header className="navbar">
      {/* top white strip */}
      <div className="navbar-top">
        <div className="socials">
          <span>IG</span>
          <span>IN</span>
          <span>X</span>
        </div>
        <div className="waitlist-top">JOIN THE WAITLIST</div>
        <div className="profile">👤</div>
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
