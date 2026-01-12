import "./waitlist.css";

export default function Waitlist() {
  return (
    <section className="waitlist">
      <div className="waitlist-content">
        <h1>Join the Waitlist</h1>

        <p className="waitlist-lead">
          Tell us about your brand and product.  
          We’ll reach out when we’re ready to launch.
        </p>

        <form className="waitlist-form">
          <input
            type="text"
            placeholder="Company Name"
            required
          />

          <input
            type="text"
            placeholder="Product"
            required
          />

          <textarea
            placeholder="Optional details (target audience, goals, timeline, etc.)"
            rows="5"
          />

          <button type="submit">Join Waitlist</button>
        </form>
      </div>
    </section>
  );
}
