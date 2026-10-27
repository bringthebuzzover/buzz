/**
 * Campus names from the live home marquee, set as a type ticker.
 * The second copy is only there so the loop has no gap.
 */
import { COLLEGES } from "../../data/colleges";

const NAMES = COLLEGES.map((college) => college.name);

function NameRow({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="pulse-marquee__group" aria-hidden={hidden || undefined}>
      {NAMES.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

export default function PulseNetwork() {
  return (
    <section className="pulse-network" aria-labelledby="pulse-network-title">
      <div className="pulse-wrap pulse-network__head">
        <h2 id="pulse-network-title" className="pulse-display">
          Our College Network
        </h2>
        <p className="pulse-network__sub">
          Vetted student organizations powering authentic campus marketing nationwide.
        </p>
      </div>
      <div className="pulse-marquee">
        <div className="pulse-marquee__track">
          <NameRow />
          <NameRow hidden />
        </div>
      </div>
    </section>
  );
}
