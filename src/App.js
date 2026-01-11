import { Routes, Route } from "react-router-dom";
import Navbar from "./components/navbar/navbar";
import Home from "./pages/home/home";
import About from "./pages/about/about";
import Contact from "./pages/contact/contact";
import Waitlist from "./pages/waitlist/waitlist";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/waitlist" element={<Waitlist />} />
      </Routes>
    </>
  );
}


