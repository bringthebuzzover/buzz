/**
 * Shared cream shell for assembled Inspo marketing. One nav/footer; sections
 * live on `/inspo`, campaign overlay on `/inspo/drop`.
 */
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import InspoFooter from "../components/inspo/InspoFooter";
import InspoNav from "../components/inspo/InspoNav";

export default function InspoLayout() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = hash.slice(1);
    let tries = 0;
    let frame = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
      if (tries < 12) {
        tries += 1;
        frame = window.requestAnimationFrame(tryScroll);
      }
    };
    frame = window.requestAnimationFrame(tryScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [hash, pathname]);

  return (
    <div className="min-h-screen bg-buzz-cream font-sans text-buzz-ink antialiased">
      <InspoNav />
      <Outlet />
      <InspoFooter />
    </div>
  );
}
