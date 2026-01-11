import "./hero.css";

export default function Hero() {
  return (
    <section className="hero">
      <video
        className="hero-video"
        src="/hero.mov"
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="hero-overlay" />

      <div className="hero-content">
        <h1>
          BRING YOUR BRAND
          <br />
          TO OUR CAMPUS
        </h1>

        <p className="tagline">BRING THE BUZZ OVER</p>

        <p className="description">
          Connecting brands with campus communities for authentic
          college marketing, at scale.
        </p>

        <button className="cta">Get Started</button>
      </div>
    </section>
  );
}
