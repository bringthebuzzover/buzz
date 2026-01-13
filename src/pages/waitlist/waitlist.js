import "./waitlist.css";
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import waitlistBackground from "../../assets/aboutBackground.png";

export default function Waitlist() {
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    product: "",
    details: "",
  });

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();

    try {
      await addDoc(collection(db, "waitlist"), {
        name: form.name,
        companyName: form.companyName,
        product: form.product,
        details: form.details,
        createdAt: serverTimestamp(),
      });

      alert("You’re on the waitlist!");
      setForm({
        name: "",
        companyName: "",
        product: "",
        details: "",
      });
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }
  };

  return (
    <section
      className="waitlist"
      style={{ backgroundImage: `url(${waitlistBackground})` }}
    >
      <div className="waitlist-overlay">
        <div className="waitlist-content">
          <div className="waitlist-card">
            <h1>Join the Waitlist</h1>

            <form className="waitlist-form" onSubmit={handleSubmit}>
              <input
                name="name"
                placeholder="Your Name"
                value={form.name}
                onChange={handleChange}
                required
              />

              <input
                name="companyName"
                placeholder="Company Name"
                value={form.companyName}
                onChange={handleChange}
                required
              />

              <input
                name="product"
                placeholder="Product"
                value={form.product}
                onChange={handleChange}
                required
              />

              <textarea
                name="details"
                placeholder="Optional details"
                value={form.details}
                onChange={handleChange}
              />

              <button type="submit">Join Waitlist</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
