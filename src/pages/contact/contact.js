import "./contact.css";

export default function Contact() {
  return (
    <section className="contact">
      <div className="contact-content">
        <h1>Contact</h1>

        <p className="contact-lead">
          Reach out anytime.
        </p>

        <div className="contact-info">
          <a href="ae101@example.edu" className="contact-item">
            ae101@example.edu
          </a>

          <a
            href="https://instagram.com/bringthebuzzover/"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-item"
          >
            @bringthebuzzover
          </a>
        </div>
      </div>
    </section>
  );
}
