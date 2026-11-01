/**
 * Paper college-network band: dotted US map, bee route, grayscale logo strip.
 * Pins use the pen's 880×550 positions. The bee follows
 * Stanford → Rice → Duke → UPenn → Cornell → UChicago.
 */
import { useEffect, useRef } from "react";
import { BeeMark } from "../ui/BrandMark";
import { COLLEGES } from "../../data/colleges";
import Marquee from "../site/Marquee";
import { US_DOTS } from "./usDots";
import { useReducedMotion } from "./useReducedMotion";

/** Pen pin positions inside the 880×550 map. */
const PINS: { name: string; x: number; y: number }[] = [
  ["Princeton", 781.6, 198.5],
  ["MIT", 821.6, 148.5],
  ["Harvard", 821.2, 148.3],
  ["Stanford", 85, 235.6],
  ["Yale", 801.5, 174.5],
  ["Columbia", 789.3, 187.5],
  ["UPenn", 775.6, 207.7],
  ["Caltech", 129.3, 312.9],
  ["Johns Hopkins", 757.8, 223.9],
  ["Dartmouth", 798.9, 127.6],
  ["UChicago", 594, 199.9],
  ["Northwestern", 592.5, 194.9],
  ["Brown", 820, 159.6],
  ["Vanderbilt", 615.8, 307.6],
  ["Cornell", 747.4, 164.4],
  ["Rice", 484.8, 438.5],
  ["UC Berkeley", 86, 227],
  ["UCLA", 124.2, 313],
  ["UMichigan", 647.3, 184.6],
  ["Duke", 735.8, 293.8],
  ["USC", 126.4, 314.5],
  ["UNC", 734.5, 295.8],
  ["Babson", 819.6, 150.2],
].map(([name, x, y]) => ({ name: String(name), x: Number(x), y: Number(y) }));

const MAP_W = 880;
const MAP_H = 550;

/** Stanford → Rice → Duke → UPenn → Cornell → UChicago → Stanford. */
const ROUTE = ["Stanford", "Rice", "Duke", "UPenn", "Cornell", "UChicago", "Stanford"];
const pinByName = (name: string) => PINS.find((pin) => pin.name === name)!;
const position = ({ x, y }: { x: number; y: number }) => ({
  left: `${(x / MAP_W) * 100}%`,
  top: `${(y / MAP_H) * 100}%`,
});

// Sample Lab's lifted quadratic arcs once; cumulative lengths keep the flight paced.
const HOPS = ROUTE.slice(0, -1).map((name, index) => {
  const from = pinByName(name);
  const to = pinByName(ROUTE[index + 1]);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const lift = Math.min(72, Math.max(18, length * 0.16));
  const sign = dx <= 0 ? 1 : -1;
  let cx = (from.x + to.x) / 2 + ((sign * -dy) / length) * lift;
  let cy = (from.y + to.y) / 2 + ((sign * dx) / length) * lift;
  if ((from.y + to.y) / 2 - cy < lift * 0.45) {
    cx = (from.x + to.x) / 2;
    cy = (from.y + to.y) / 2 - lift;
  }
  let distance = 0;
  let previous: { x: number; y: number } = from;
  const points = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t * t * to.y;
    if (i) distance += Math.hypot(x - previous.x, y - previous.y);
    const point = { x, y, distance };
    previous = point;
    return point;
  });
  return { name, points, length: distance };
});
const FLIGHT_LENGTH = HOPS.reduce((sum, hop) => sum + hop.length, 0);

export function CollegeNetwork() {
  const reduce = useReducedMotion();
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || reduce) return;
    const flyers = Array.from(map.querySelectorAll<HTMLElement>("[data-flyer]"));
    const pins = Array.from(map.querySelectorAll<HTMLElement>("[data-campus]"));
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    let visible = typeof IntersectionObserver === "undefined";
    const paint = (time: number) => {
      if (visible && !document.hidden && previous)
        elapsed += (time - previous) / 1000;
      previous = time;
      let local = elapsed % 10;
      let distance = 0;
      let visiting = "";
      for (const hop of HOPS) {
        if (local < 0.4) {
          visiting = hop.name;
          break;
        }
        local -= 0.4;
        const duration = (hop.length / FLIGHT_LENGTH) * 7.6;
        if (local < duration) {
          distance += (local / duration) * hop.length;
          break;
        }
        local -= duration;
        distance += hop.length;
      }
      flyers.forEach((flyer, i) => {
        const lag =
          i === 0 ? 0 : ((0.07 + (i / 10) * 0.8) / 1.5 / 7.6) * FLIGHT_LENGTH;
        let at = (distance - lag + FLIGHT_LENGTH) % FLIGHT_LENGTH;
        let hop = HOPS[HOPS.length - 1];
        for (const candidate of HOPS) {
          hop = candidate;
          if (at <= hop.length) break;
          at -= hop.length;
        }
        const end = hop.points.findIndex((point) => point.distance >= at);
        const to = hop.points[Math.max(1, end)];
        const from = hop.points[Math.max(1, end) - 1];
        const t = (at - from.distance) / (to.distance - from.distance);
        flyer.style.left = `${((from.x + (to.x - from.x) * t) / MAP_W) * 100}%`;
        flyer.style.top = `${((from.y + (to.y - from.y) * t) / MAP_H) * 100}%`;
        flyer.style.transform = `translate(-50%, -50%) rotate(${i ? 0 : (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 50}deg)`;
      });
      pins.forEach((pin) => {
        pin.dataset.visiting = String(pin.dataset.campus === visiting);
      });
      if (visible && !document.hidden) frame = window.requestAnimationFrame(paint);
    };
    const resume = () => {
      window.cancelAnimationFrame(frame);
      previous = 0;
      if (visible && !document.hidden) frame = window.requestAnimationFrame(paint);
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible = entries.some((entry) => entry.isIntersecting);
              resume();
            },
            { threshold: 0.15 },
          );
    observer?.observe(map);
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resume);
      observer?.disconnect();
    };
  }, [reduce]);
  return (
    <section
      data-nav-surface="paper"
      className="bg-[#f0f0f0] px-4 py-[68px] text-on-accent md:px-0 md:py-[108px]"
    >
      <div className="mx-auto flex max-w-[880px] flex-col items-center text-center">
        <h2 className="text-[28px] font-medium leading-none tracking-tight md:text-buzzH2">
          College network
        </h2>
        <p className="mt-4 max-w-xl text-base leading-normal text-on-accent/65">
          Vetted student organizations powering authentic campus marketing nationwide.
        </p>
        <div
          key={reduce ? "parked" : "flying"}
          ref={mapRef}
          className="relative mt-12 aspect-[880/550] w-full max-w-[880px]"
        >
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="h-full w-full"
            aria-hidden
          >
            {US_DOTS.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="#0b0b0b" opacity="0.28" />
            ))}
          </svg>
          {PINS.map((pin) => (
            <span
              data-campus={pin.name}
              data-visiting={reduce && pin.name === "Cornell" ? "true" : undefined}
              key={pin.name}
              title={pin.name}
              className="marketing-pin absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2"
              style={position(pin)}
            >
              <span className="absolute inset-0 rounded-full bg-on-accent" />
              <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
              <span
                className="marketing-pin-label pointer-events-none absolute bottom-5 rounded-full bg-page px-3 py-1 text-xs text-primary"
                style={{ [pin.x > MAP_W / 2 ? "right" : "left"]: 0 }}
              >
                {pin.name}
              </span>
            </span>
          ))}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <span
              data-flyer
              className="absolute"
              style={{
                ...position(pinByName("Cornell")),
                transform: "translate(-50%, -50%)",
              }}
            >
              <BeeMark
                className={`h-[17px] w-[17px] md:h-[26px] md:w-[26px] ${reduce ? "" : "bee-flap"}`}
              />
            </span>
            {reduce
              ? null
              : Array.from({ length: 9 }, (_, index) => (
                  <span
                    key={index}
                    data-flyer
                    className="absolute rounded-full bg-on-accent"
                    style={{
                      width: `${9.2 * (1 - ((index + 1) / 10) * 0.68)}px`,
                      height: `${9.2 * (1 - ((index + 1) / 10) * 0.68)}px`,
                      opacity: 0.92 * (1 - (index + 1) / 10) ** 1.15,
                    }}
                  />
                ))}
          </div>
        </div>
      </div>
      <div className="mt-16">
        <Marquee items={COLLEGES} />
      </div>
    </section>
  );
}
