import "./about.css";
import aboutImg from "../../assets/aboutBackground.png";

export default function About() {
  return (
    <section
      className="about"
      style={{
        backgroundImage: `url(${aboutImg})`,
      }}
    >
      <div className="about-content">
        <div className="about-card">
          <h1 className="about-title">
            <span className="from-left">About</span>{" "}
            <span className="from-right">Buzz</span>
          </h1>

          <p className="about-lead">
            Buzz connects brands with real campus communities through authentic,
            student driven marketing.
          </p>

          <p>
            We believe the most powerful marketing doesn’t feel like marketing.
            It lives in the places students already trust: their clubs, events,
            and social spaces.
          </p>

          <p>
            Our platform enables brands to activate campaigns directly on campus,
            powered by student ambassadors who understand their communities best.
          </p>
        </div>
      </div>
    </section>
  );
}
