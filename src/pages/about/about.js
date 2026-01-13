import "./about.css";
import aboutHero from "../../assets/aboutBackground.png";
import campus1 from "../../assets/campus1.png";
import campus2 from "../../assets/campus2.png";

export default function About() {
  return (
    <>
      {/* HERO */}
      <section
        className="about-hero"
        style={{ backgroundImage: `url(${aboutHero})` }}
      >
        <div className="about-hero-overlay" />

        <div className="about-hero-content">
          <p className="about-eyebrow">OUR STORY</p>
          <h1 className="about-hero-title">Buzz to its Core</h1>
        </div>
      </section>

      {/* SPLIT CONTENT */}
     <section className="about-split">

      {/* FULL-WIDTH MISSION */}
      <div className="container-wide">
        <div className="about-mission">
          <h2>Our Mission</h2>
          <p>
            Buzz is a platform that bridges the gap between brands and college
            campuses. We empower student organizations to partner with exciting
            brands while helping companies reach their target audience in an
            authentic, community-driven way.
          </p>
        </div>
      </div>

      {/* CONSTRAINED WHY + IMAGE */}
      <div className="container-narrow">
        <div className="about-split-inner">

          <div className="about-text">
            <h2>Why Campus Marketing?</h2>
            <p>
              College students are influential tastemakers and early adopters.
              By partnering with trusted campus organizations, brands build
              authentic relationships that traditional advertising simply can’t match.
            </p>
          </div>

          <div className="about-images">
            <img src={campus1} alt="Campus activation" />
          </div>

        </div>
      </div>

    </section>


      {/* HOW IT WORKS */}
      <section className="about-steps">
        <div className="about-steps-inner">
          <div className="step-card">
            <span>01</span>
            <h3>Organizations Register</h3>
            <p>Campus groups join Buzz and create their profile.</p>
          </div>

          <div className="step-card">
            <span>02</span>
            <h3>Brands Launch Campaigns</h3>
            <p>Companies create targeted campus marketing campaigns.</p>
          </div>

          <div className="step-card">
            <span>03</span>
            <h3>Magic Happens</h3>
            <p>Organizations bring brands directly to their campus community.</p>
          </div>
        </div>
      </section>

      {/* RIBBON */}
      <section className="about-ribbon">
        <div className="ribbon-track">
          <span>BUZZ ON CAMPUS</span>
          <span>BUZZ ON CAMPUS</span>
          <span>BUZZ ON CAMPUS</span>
          <span>BUZZ ON CAMPUS</span>
        </div>
      </section>
    </>
  );
}
