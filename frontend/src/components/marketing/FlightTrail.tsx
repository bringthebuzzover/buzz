import { useEffect, useRef, useState } from "react";
import { publicAsset } from "../../utils/publicAsset";
import { FLIGHT_BANDS, SEAM_GAP } from "./flightPathData";
import { useReducedMotion } from "./useReducedMotion";

type Path = {
  points: readonly (readonly [number, number])[];
  lengths: number[];
  total: number;
};

function positionAt({ points, lengths, total }: Path, distance: number) {
  const s = Math.min(Math.max(distance, 0), total);
  let low = 1;
  let high = lengths.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lengths[mid] < s) low = mid + 1;
    else high = mid;
  }
  const [x, y] = points[low - 1];
  const [nextX, nextY] = points[low];
  const t = (s - lengths[low - 1]) / (lengths[low] - lengths[low - 1]);
  return { x: x + (nextX - x) * t, y: y + (nextY - y) * t };
}

function sampleAt(path: Path, s: number) {
  const point = positionAt(path, s);
  const atEnd = s > path.total - 8;
  const neighbor = positionAt(path, atEnd ? s - 8 : Math.min(s + 8, path.total));
  const direction = atEnd ? -1 : 1;
  const angle =
    (Math.atan2((neighbor.y - point.y) * direction, (neighbor.x - point.x) * direction) *
      180) /
      Math.PI +
    90;
  return { ...point, angle };
}

const PAN = 0.2;

const BANDS = FLIGHT_BANDS.map((points) => {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [previousX, previousY] = points[i - 1];
    lengths.push(lengths[i - 1] + Math.hypot(x - previousX, y - previousY));
  }
  const total = lengths[lengths.length - 1];
  const path = { points, lengths, total };
  const dots = Array.from({ length: Math.floor(total / 16) + 1 }, (_, index) => {
    const s = index * 16;
    return { ...positionAt(path, s), s };
  });
  return { ...path, dots };
});

export function FlightTrail({ progress }: { progress: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(progress);
  const shownRef = useRef(progress);

  useEffect(() => {
    if (reduce) {
      shownRef.current = progress;
      return;
    }
    let frame = 0;
    const tick = () => {
      const next = shownRef.current + (progress - shownRef.current) * 0.18;
      const settled = Math.abs(progress - next) < 0.0005;
      shownRef.current = settled ? progress : next;
      setShown(shownRef.current);
      if (!settled) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [progress, reduce]);

  const scroll = Math.min(Math.max(reduce ? progress : shown, 0), 1);
  const band = Math.min(Math.max(Math.floor(scroll * 4), 0), 3);
  const t = Math.min(Math.max(scroll * 4 - band, 0), 1);
  const path = BANDS[band];
  const sBee = t * path.total;
  const bee = sampleAt(path, sBee);
  const outgoing = band > 0 && t < PAN ? BANDS[band - 1] : null;
  const u = t / PAN;

  return (
    <svg
      viewBox="0 0 1440 900"
      className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-hidden md:block"
      aria-hidden
    >
      {outgoing && (
        <g transform={`translate(0 ${-SEAM_GAP[band - 1] * u})`}>
          <g opacity={1 - u}>
            {outgoing.dots.map((dot) => {
              const fade = reduce ? 0 : Math.exp(-(outgoing.total - dot.s) / 700);
              return (
                <circle
                  key={dot.s}
                  cx={dot.x}
                  cy={dot.y}
                  r={2.45 + 0.95 * fade}
                  opacity={0.22 + 0.73 * fade}
                  fill="#0b0b0b"
                />
              );
            })}
          </g>
        </g>
      )}
      <g>
        {path.dots.map((dot) => {
          if (dot.s > sBee) return null;
          const fade = reduce ? 0 : Math.exp(-(sBee - dot.s) / 700);
          return (
            <circle
              key={dot.s}
              cx={dot.x}
              cy={dot.y}
              r={2.45 + 0.95 * fade}
              opacity={0.22 + 0.73 * fade}
              fill="#0b0b0b"
            />
          );
        })}
      </g>
      <g transform={`translate(${bee.x} ${bee.y}) rotate(${bee.angle})`}>
        <image href={publicAsset("logos/bee.svg")} x={-13} y={-13} width={26} height={26} />
      </g>
    </svg>
  );
}
