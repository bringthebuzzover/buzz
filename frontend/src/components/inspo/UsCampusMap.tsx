/**
 * Dotted continental US with campus pins — brand-hero inspo (Paper I0).
 * Positions are illustrative, not GIS-accurate.
 */
import { COLLEGES } from "../../data/colleges";

const PINS: ReadonlyArray<{ left: string; top: string; i: number }> = [
  { left: "18%", top: "42%", i: 0 },
  { left: "22%", top: "28%", i: 1 },
  { left: "28%", top: "52%", i: 2 },
  { left: "34%", top: "38%", i: 3 },
  { left: "41%", top: "48%", i: 4 },
  { left: "48%", top: "32%", i: 5 },
  { left: "52%", top: "44%", i: 6 },
  { left: "56%", top: "28%", i: 7 },
  { left: "61%", top: "36%", i: 8 },
  { left: "66%", top: "24%", i: 9 },
  { left: "70%", top: "42%", i: 10 },
  { left: "74%", top: "30%", i: 11 },
  { left: "78%", top: "48%", i: 12 },
  { left: "82%", top: "36%", i: 13 },
  { left: "72%", top: "58%", i: 14 },
  { left: "64%", top: "62%", i: 15 },
  { left: "86%", top: "68%", i: 16 },
  { left: "44%", top: "58%", i: 17 },
  { left: "38%", top: "22%", i: 18 },
];

export default function UsCampusMap() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-xl">
      <svg viewBox="0 0 400 260" className="h-full w-full" aria-hidden>
        <defs>
          <clipPath id="inspo-us-clip">
            <path d="M38 72c8-18 28-28 52-32 22-4 38 6 58 4 18-2 28-16 48-18 24-2 40 10 62 8 18-2 32-14 52-10 16 4 28 18 32 36 6 22-2 40 4 62 4 16 18 24 16 42-2 16-18 22-34 28-22 8-40 4-60 12-18 8-22 24-42 28-24 4-40-10-62-8-20 2-32 16-52 14-22-2-36-16-48-32-10-14-8-32-16-48-8-18-22-24-20-46 2-16 10-28 18-40z" />
          </clipPath>
        </defs>
        <g clipPath="url(#inspo-us-clip)">
          {Array.from({ length: 18 }, (_, row) =>
            Array.from({ length: 28 }, (_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={20 + col * 13}
                cy={20 + row * 13}
                r="2.4"
                className="fill-buzz-coral/80"
              />
            )),
          )}
        </g>
      </svg>
      {PINS.map((pin) => {
        const college = COLLEGES[pin.i % COLLEGES.length];
        return (
          <span
            key={`${pin.left}-${pin.top}`}
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border border-white bg-white shadow-buzz"
            style={{ left: pin.left, top: pin.top }}
            title={college.name}
          >
            {college.logoSrc ? (
              <img src={college.logoSrc} alt="" className="h-5 w-5 object-contain" />
            ) : (
              <span className="text-xs font-semibold text-buzz-coral">
                {college.name.slice(0, 1)}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
