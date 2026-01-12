import "./waitlist.css";
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

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
    <section className="waitlist">
      <div className="waitlist-content">
        <h1>Join the Waitlist</h1>

        <form className="waitlist-form" onSubmit={handleSubmit}>
          {/* NAME */}
          <input
            name="name"
            placeholder="Your Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          {/* COMPANY */}
          <input
            name="companyName"
            placeholder="Company Name"
            value={form.companyName}
            onChange={handleChange}
            required
          />

          {/* PRODUCT */}
          <input
            name="product"
            placeholder="Product"
            value={form.product}
            onChange={handleChange}
            required
          />

          {/* OPTIONAL DETAILS */}
          <textarea
            name="details"
            placeholder="Optional details"
            value={form.details}
            onChange={handleChange}
          />

          <button type="submit">Join Waitlist</button>
        </form>
      </div>
    </section>
  );
}
