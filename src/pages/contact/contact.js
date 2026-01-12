import "./contact.css";
import contactBackground from "../../assets/contactBackground.png";
import instagramIcon from "../../assets/insta-icon.png";
import linkedinIcon from "../../assets/linkedin-icon.png";
import emailIcon from "../../assets/email-icon.png";

export default function Contact() {
  return (
    <section
      className="contact"
      style={{ backgroundImage: `url(${contactBackground})` }}
    >
      <div className="contact-overlay">
        <div className="contact-card">
          <h1>Contact Us</h1>

          <p className="contact-lead">
            Reach out anytime!
          </p>

          <div className="contact-info">
            {/* Email */}
            <a
              href="mailto:ae101@example.edu"
              className="contact-item"
            >
              <img
                src={emailIcon}
                alt="Email"
                className="contact-icon"
              />
              ae101@example.edu
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com/bringthebuzzover/"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-item"
            >
              <img
                src={instagramIcon}
                alt="Instagram"
                className="contact-icon"
              />
              @bringthebuzzover
            </a>

            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/in/melissachowdhury/"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-item"
            >
              <img
                src={linkedinIcon}
                alt="LinkedIn"
                className="contact-icon"
              />
              Avery Example
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
