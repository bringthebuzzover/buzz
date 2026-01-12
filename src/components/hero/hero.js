import "./hero.css";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="hero">
      <video
        className="hero-video"
        src={`${process.env.PUBLIC_URL}/hero.mp4`}
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="hero-overlay" />

      <div className="hero-content">
        <h1>
          BRING YOUR
          <br />
          BRAND
          <br />
          TO OUR 
          <br />
          CAMPUS
        </h1>

        <p className="tagline">BRING THE BUZZ OVER</p>

        <p className="description">
          Connecting brands with campus communities for authentic
          college marketing, at scale.
        </p>

        <Link to="/waitlist" className="cta">
            Get Started
        </Link>
      </div>
    </section>
  );
}
