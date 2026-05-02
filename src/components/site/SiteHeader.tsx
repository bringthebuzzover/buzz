/**
 * Sticky two-row header: utility bar (socials, JOIN, account), coral nav with centered logo (home),
 * and nav actions where “Contact” calls `openContactModal` from `useSiteChrome`.
 */
import { Link, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { siteIdentity } from "../../data/siteIdentity";
import { useSiteChrome } from "../../contexts/SiteChromeContext";

export default function SiteHeader() {
  const navigate = useNavigate();
  const { openContactModal } = useSiteChrome();
  const { images, social } = siteIdentity;

  return (
    <header className="relative z-50 w-full">
      <div className="relative flex h-10 items-center justify-center border-b border-buzz-line bg-buzz-cream px-6 text-xs font-semibold tracking-wider">
        <div className="absolute left-6 flex space-x-4">
          <a
            href={social.instagram.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-buzz-inkMuted hover:opacity-80"
            aria-label="Instagram"
          >
            <img src={images.socialInstagramIcon} alt="" className="h-4 w-4" />
          </a>
          <a
            href={social.linkedin.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-buzz-inkMuted hover:opacity-80"
            aria-label="LinkedIn"
          >
            <img src={images.socialLinkedinIcon} alt="" className="h-4 w-4" />
          </a>
        </div>
        <button
          type="button"
          onClick={() => navigate("/register")}
          className="cursor-pointer text-center font-bold text-buzz-coral hover:underline"
        >
          JOIN!
        </button>
        <div className="absolute right-6 flex items-center gap-4">
          <Link
            to="/brand"
            className="hidden text-buzz-coral hover:text-buzz-coralDark md:block"
          >
            Brand Portal
          </Link>
          <button
            type="button"
            onClick={() => navigate("/register")}
            aria-label="Account"
            className="text-buzz-inkMuted hover:text-buzz-coral"
          >
            <User size={18} />
          </button>
        </div>
      </div>

      <nav className="relative flex h-16 items-center justify-between bg-buzz-coral px-8 py-4 text-buzz-paper shadow-sm">
        <div className="flex space-x-8 font-medium">
          <Link to="/" className="transition hover:text-buzz-butterBright">
            Home
          </Link>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute left-1/2 top-[-8px] z-10 flex h-20 w-72 -translate-x-1/2 origin-bottom cursor-pointer flex-col items-center justify-center bg-buzz-coralDark px-4 shadow-sm transition-transform duration-200 ease-out hover:scale-[1.03]"
        >
          <img
            src={images.logo}
            alt={images.logoAlt}
            className="max-h-11 w-auto max-w-[200px] object-contain"
          />
          <span className="mt-1 text-[10px] font-light tracking-wider text-buzz-paper">
            {social.instagram.handleWithAt}
          </span>
        </button>

        <div className="flex space-x-8 font-medium">
          <button
            type="button"
            onClick={openContactModal}
            className="transition hover:text-buzz-butterBright"
          >
            Contact
          </button>
          <Link to="/register" className="transition hover:text-buzz-butterBright">
            Join!
          </Link>
        </div>
      </nav>
    </header>
  );
}
