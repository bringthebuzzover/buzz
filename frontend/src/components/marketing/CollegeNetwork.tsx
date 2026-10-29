/**
 * Paper college-network band: dotted US map, bee route, grayscale logo strip.
 * Pins use the pen's 880×550 positions. The bee follows
 * Stanford → Rice → Duke → UPenn → Cornell → UChicago.
 */
import { BeeMark } from "../ui/BrandMark";
import { cn } from "../../theme/cn";
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

function pinByName(name: string) {
  const pin = PINS.find((item) => item.name === name);
  if (!pin) return { x: 0, y: 0 };
  return pin;
}

const ROUTE_PATH = `polygon(${ROUTE.map((name) => {
  const pin = pinByName(name);
  return `${(pin.x / MAP_W) * 100}% ${(pin.y / MAP_H) * 100}%`;
}).join(", ")})`;

export function CollegeNetwork() {
  const reduce = useReducedMotion();
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
        <div className="relative mt-12 aspect-[880/550] w-full max-w-[880px]">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-full w-full" aria-hidden>
            {US_DOTS.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="#0b0b0b" opacity="0.28" />
            ))}
          </svg>
          {PINS.map((pin) => (
            <span
              key={pin.name}
              title={pin.name}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(pin.x / MAP_W) * 100}%`, top: `${(pin.y / MAP_H) * 100}%` }}
            >
              <span className="absolute inset-0 rounded-full bg-on-accent" />
              <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
            </span>
          ))}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {reduce
              ? null
              : Array.from({ length: 9 }, (_, index) => (
                <span
                  key={index}
                  className="bee-route absolute rounded-full bg-on-accent"
                  style={{
                    offsetPath: ROUTE_PATH,
                    width: `${8.6 - index * 0.55}px`,
                    height: `${8.6 - index * 0.55}px`,
                    opacity: 0.34,
                    animationDelay: `${-index * 0.18}s`,
                  }}
                />
              ))}
            <span
              className={cn("absolute", !reduce && "bee-route")}
              style={
                reduce
                  ? {
                      left: "74%",
                      top: "56%",
                      transform: "translate(-50%, -50%) rotate(-27deg)",
                    }
                  : { offsetPath: ROUTE_PATH }
              }
            >
              <BeeMark
                className={cn(
                  "h-[17px] w-[17px] md:h-[26px] md:w-[26px]",
                  !reduce && "bee-flap",
                )}
              />
            </span>
          </div>
        </div>
      </div>
      <div className="mt-16">
        <Marquee items={COLLEGES} title="College network" embedded />
      </div>
    </section>
  );
}
