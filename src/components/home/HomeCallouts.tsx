/**
 * Two-column promo: brand path (“Create a Campaign” → `/brand`) and student path (“Register” → `/register`),
 * each with bullets and a primary CTA button.
 */
import { useNavigate } from "react-router-dom";

export default function HomeCallouts() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-8 py-12 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-2xl border border-buzz-coral bg-gradient-to-br from-buzz-coral to-buzz-coralLight p-10 text-buzz-paper shadow-sm">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/4 -translate-y-1/2 rounded-full bg-buzz-butter/20" />
        <h3 className="relative z-10 mb-4 text-3xl font-bold">Create a Campaign</h3>
        <p className="relative z-10 mb-8 max-w-md opacity-90">
          Launch your brand campaign and connect with student organizations who can
          authentically represent your products on college campuses.
        </p>
        <ul className="relative z-10 mb-8 space-y-3 font-medium opacity-90">
          <li className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-buzz-butter" />
            Search through 25+ top college campuses
          </li>
          <li className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-buzz-butter" />
            Verified campus organizations & sororities
          </li>
          <li className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-buzz-butter" />
            Select the perfect groups for your campaign
          </li>
        </ul>
        <button
          type="button"
          onClick={() => navigate("/brand")}
          className="relative z-10 rounded-lg bg-buzz-butter px-8 py-3 font-bold text-buzz-coral shadow-sm transition hover:bg-buzz-butterBright"
        >
          Post a Campaign
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-butter p-10 text-buzz-ink shadow-sm">
        <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-1/4 translate-y-1/4 rotate-45 bg-buzz-butterBright/50" />
        <h3 className="relative z-10 mb-4 text-3xl font-bold text-buzz-coral">
          Register Your Campus Group
        </h3>
        <p className="relative z-10 mb-8 max-w-md font-medium text-buzz-inkMuted">
          Join our network of campus organizations and apply to host exciting brand
          campaigns at your college.
        </p>
        <ul className="relative z-10 mb-8 space-y-3 font-medium text-buzz-inkMuted">
          <li className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-buzz-coral" />
            Represent your sorority, fraternity or club
          </li>
          <li className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-buzz-coral" />
            Access exclusive products and PR packages
          </li>
          <li className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-buzz-coral" />
            Apply to brand campaigns that interest you
          </li>
        </ul>
        <button
          type="button"
          onClick={() => navigate("/register")}
          className="relative z-10 rounded-lg bg-buzz-coral px-8 py-3 font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
        >
          Register Your Group
        </button>
      </div>
    </section>
  );
}
