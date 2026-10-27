/**
 * Decorative flight across the public home section.
 *
 * The route is one closed cubic spline from the section’s left edge to its
 * right edge and back, weaving through the heading on the way. A single
 * paced clock moves the bee and a comet of coral dots; older dots are
 * farther behind and fade to nothing, so the path itself is not drawn.
 * The markup is parsed as SVG (not built by React) so SMIL starts.
 * prefers-reduced-motion hides this overlay; the heading keeps a still bee.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { publicLogo } from "../../utils/publicLogo";
import { tailwindThemeExtend } from "../../theme/palette";

const BEE_SRC = publicLogo("bee.svg");
const CORAL = tailwindThemeExtend.colors.buzz.coral;

/**
 * Logo head points up-right (~50° above +x). Clockwise 50° lays that
 * nose on +x, which animateMotion rotate="auto" then aims along the path.
 * Body-mass center of bee.svg sits at about (45.4%, 58.6%) of the image.
 */
const NOSE_CLOCKWISE_DEG = 50;
const BODY_X = 0.454;
const BODY_Y = 0.586;

/** Pixel speed of the longer loops. Narrower sections stay at least 8s. */
const PX_PER_SEC = 144;
const MIN_LOOP_SECONDS = 8;

type Pt = [number, number];
type Bezier = { p0: Pt; p1: Pt; p2: Pt; p3: Pt };

type Flight = {
  svgTop: number;
  svgHeight: number;
  markup: string;
};

/**
 * Newest dot is closest to the bee. Opacity falls off with lag and the
 * last dot is nearly clear, so the tail disappears instead of staining
 * the route.
 */
const TRAIL = Array.from({ length: 13 }, (_, i) => {
  const t = (i + 1) / 14;
  return {
    lag: 0.07 + t * 1.1,
    opacity: 0.92 * (1 - t) ** 1.5,
    scale: 1 - t * 0.62,
  };
}).filter((step) => step.opacity >= 0.03);

function solvePeriodic(lower: number[], diag: number[], upper: number[], rhs: number[]): number[] {
  const n = rhs.length;
  const m = lower.map((_, i) => {
    const row = Array(n + 1).fill(0);
    row[i] = diag[i];
    row[(i + n - 1) % n] += lower[i];
    row[(i + 1) % n] += upper[i];
    row[n] = rhs[i];
    return row;
  });
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const div = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col];
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }
  return m.map((row) => row[n]);
}

/** Closed chord-length cubic spline. C2, so the seam matches the start. */
function splineBeziers(points: Pt[]): Bezier[] {
  const n = points.length;
  const h = points.map((p, i) => Math.hypot(p[0] - points[(i + 1) % n][0], p[1] - points[(i + 1) % n][1]));
  const tangents: Pt[] = Array.from({ length: n }, () => [0, 0]);
  for (const axis of [0, 1] as const) {
    const lower: number[] = [];
    const diag: number[] = [];
    const upper: number[] = [];
    const rhs: number[] = [];
    for (let i = 0; i < n; i++) {
      const prev = (i + n - 1) % n;
      const next = (i + 1) % n;
      const hm = h[prev];
      const hp = h[i];
      lower.push(hp);
      diag.push(2 * (hm + hp));
      upper.push(hm);
      rhs.push(
        3 * ((hp / hm) * (points[i][axis] - points[prev][axis]) + (hm / hp) * (points[next][axis] - points[i][axis])),
      );
    }
    const solved = solvePeriodic(lower, diag, upper, rhs);
    for (let i = 0; i < n; i++) tangents[i][axis] = solved[i];
  }
  return points.map((p, i) => {
    const next = (i + 1) % n;
    const hi = h[i];
    return {
      p0: p,
      p1: [p[0] + (hi * tangents[i][0]) / 3, p[1] + (hi * tangents[i][1]) / 3],
      p2: [
        points[next][0] - (hi * tangents[next][0]) / 3,
        points[next][1] - (hi * tangents[next][1]) / 3,
      ],
      p3: points[next],
    };
  });
}

function pathData(beziers: Bezier[]): string {
  const n = (v: number) => v.toFixed(2);
  let d = `M ${n(beziers[0].p0[0])} ${n(beziers[0].p0[1])}`;
  for (const b of beziers) {
    d += ` C ${n(b.p1[0])} ${n(b.p1[1])} ${n(b.p2[0])} ${n(b.p2[1])} ${n(b.p3[0])} ${n(b.p3[1])}`;
  }
  return d;
}

function pointAt(b: Bezier, u: number): Pt {
  const m = 1 - u;
  const c = (axis: 0 | 1) =>
    m * m * m * b.p0[axis] + 3 * m * m * u * b.p1[axis] + 3 * m * u * u * b.p2[axis] + u * u * u * b.p3[axis];
  return [c(0), c(1)];
}

function arcLength(beziers: Bezier[]): number {
  let len = 0;
  for (const b of beziers) {
    let prev = b.p0;
    for (let s = 1; s <= 20; s++) {
      const p = pointAt(b, s / 20);
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
  }
  return len;
}

function arc(cx: number, cy: number, rx: number, ry: number, fromDeg: number, toDeg: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return pts;
}

function pushToward(pts: Pt[], target: Pt, step: number) {
  const prev = pts[pts.length - 1];
  const dist = Math.hypot(target[0] - prev[0], target[1] - prev[1]);
  const n = Math.max(1, Math.round(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push([prev[0] + (target[0] - prev[0]) * t, prev[1] + (target[1] - prev[1]) * t]);
  }
}

/** Even spacing so the long edge-to-edge legs don’t flatten the loops. */
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (dist === 0) continue;
    while (acc + dist >= step) {
      const t = (step - acc) / dist;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a);
      dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc = 0;
    }
    acc += dist;
  }
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > step * 0.35) out.push(last);
  if (out.length > 3 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < step) {
    out.pop();
  }
  return out;
}

type Word = { c: Pt; halfW: number; halfH: number; top: number };

type Words = {
  width: number;
  headingTop: number;
  headingHeight: number;
  bring: Word;
  buzz: Word;
  over: Word;
};

/**
 * Section-pixel waypoints. Y grows downward. The outbound lane runs through
 * the heading; the return lane sits just below it. U-turns at the two
 * edges are semicircles so the loop can close without a corner.
 */
function routePoints(w: Words): Pt[] {
  const bee = w.headingHeight > 52 ? 19 : 29;
  const inset = Math.ceil(bee * 0.75) + 12;
  const left = inset;
  const right = w.width - inset;
  const wrapped = w.over.c[1] > w.bring.c[1] + 8;
  const lane = w.bring.c[1];
  const headingBottom = w.headingTop + w.headingHeight;
  const returnY = headingBottom + 12;
  const radius = Math.max(18, (returnY - lane) / 2);
  const turnCy = lane + radius;
  const step = 48;

  const pts: Pt[] = [[left + radius, lane]];
  pushToward(pts, [w.bring.c[0], lane], step);

  const rx = Math.min(w.buzz.halfW + (wrapped ? 8 : 18), Math.max(28, Math.abs(w.buzz.c[0] - w.bring.c[0]) * 0.55));
  const ry = wrapped
    ? Math.max(10, Math.min(w.buzz.halfH - 2, w.over.top - w.buzz.c[1] - 4))
    : Math.max(18, Math.min(w.buzz.halfH + 14, returnY - w.buzz.c[1] - 10));
  pts.push(...arc(w.buzz.c[0], w.buzz.c[1], rx, ry, 160, 160 + 360, 18));

  if (!wrapped) {
    const above = w.over.top - 12;
    pushToward(pts, [(w.buzz.c[0] + w.over.c[0]) / 2, above], 24);
    pushToward(pts, [w.over.c[0], above], 24);
    pushToward(pts, [(w.over.c[0] + right - radius) / 2, lane], step);
  }
  pushToward(pts, [right - radius, lane], step);
  pts.push(...arc(right - radius, turnCy, radius, radius, 270, 270 + 180, 12));
  pushToward(pts, [left + radius, returnY], step);
  pts.push(...arc(left + radius, turnCy, radius, radius, 90, 90 + 180, 12));
  return resample(pts, 16);
}

function flightMarkup(words: Words): { markup: string; svgTop: number; svgHeight: number } {
  const bee = words.headingHeight > 52 ? 19 : 29;
  const dot = bee === 19 ? 3.1 : 4.6;
  const raw = routePoints(words);
  const ys = raw.map((p) => p[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const svgTop = Math.max(0, Math.floor(minY - bee - 8));
  const svgHeight = Math.ceil(maxY + bee + 10 - svgTop);
  const local = raw.map(([x, y]): Pt => [x, y - svgTop]);
  const beziers = splineBeziers(local);
  const seconds = Math.max(MIN_LOOP_SECONDS, Math.round((arcLength(beziers) / PX_PER_SEC) * 10) / 10);
  const path = pathData(beziers);
  const trail = TRAIL.map((step) => {
    const behind = (seconds - step.lag).toFixed(2);
    const radius = (dot * step.scale).toFixed(2);
    const opacity = step.opacity.toFixed(3);
    return `<circle r="${radius}" fill="${CORAL}" opacity="${opacity}"><animateMotion dur="${seconds}s" repeatCount="indefinite" begin="-${behind}s" calcMode="paced" rotate="0"><mpath href="#home-bee-flight" xlink:href="#home-bee-flight"/></animateMotion></circle>`;
  }).join("");
  const beeUrl = BEE_SRC.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const markup = `<svg viewBox="0 0 ${words.width} ${svgHeight}" width="${words.width}" height="${svgHeight}" overflow="visible" focusable="false" data-bee-dur="${seconds}"><path id="home-bee-flight" d="${path}" fill="none"/>${trail}<g><animateMotion dur="${seconds}s" repeatCount="indefinite" begin="0s" calcMode="paced" rotate="auto"><mpath href="#home-bee-flight" xlink:href="#home-bee-flight"/></animateMotion><g transform="rotate(${NOSE_CLOCKWISE_DEG})"><image href="${beeUrl}" xlink:href="${beeUrl}" x="${(-bee * BODY_X).toFixed(2)}" y="${(-bee * BODY_Y).toFixed(2)}" width="${bee}" height="${bee}"/></g></g></svg>`;
  return { markup, svgTop, svgHeight };
}

function wordBox(heading: HTMLElement, phrase: string, originLeft: number, originTop: number): Word | null {
  const node = [...heading.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.includes(phrase));
  if (!node?.textContent) return null;
  const start = node.textContent.indexOf(phrase);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + phrase.length);
  const box = range.getBoundingClientRect();
  range.detach();
  return {
    c: [box.left + box.width / 2 - originLeft, box.top + box.height / 2 - originTop],
    halfW: box.width / 2,
    halfH: box.height / 2,
    top: box.top - originTop,
  };
}

function readFlight(section: HTMLElement): Flight | null {
  const heading = section.querySelector("h2");
  if (!heading) return null;
  const sectionBox = section.getBoundingClientRect();
  const headingBox = heading.getBoundingClientRect();
  const width = Math.round(section.clientWidth);
  if (width < 40) return null;
  const bring = wordBox(heading, "Bring the", sectionBox.left, sectionBox.top);
  const buzz = wordBox(heading, "Buzz", sectionBox.left, sectionBox.top);
  const over = wordBox(heading, "Over", sectionBox.left, sectionBox.top);
  if (!bring || !buzz || !over) return null;
  const words: Words = {
    width,
    headingTop: headingBox.top - sectionBox.top,
    headingHeight: headingBox.height,
    bring,
    buzz,
    over,
  };
  const drawn = flightMarkup(words);
  return { svgTop: drawn.svgTop, svgHeight: drawn.svgHeight, markup: drawn.markup };
}

export default function HomeFlyingBee({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<Flight | null>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current ?? rootRef.current?.parentElement;
    if (!(section instanceof HTMLElement)) return;
    const measure = () => {
      const next = readFlight(section);
      setFlight((prev) => {
        if (!next) return null;
        if (
          prev &&
          prev.markup === next.markup &&
          prev.svgTop === next.svgTop &&
          prev.svgHeight === next.svgHeight
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    const heading = section.querySelector("h2");
    if (heading) observer.observe(heading);
    return () => observer.disconnect();
  }, [sectionRef]);

  return (
    <div ref={rootRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {flight ? (
        <div
          className="motion-reduce:hidden"
          style={{ position: "absolute", left: 0, top: flight.svgTop, width: "100%", height: flight.svgHeight }}
          // Parsed by the browser so the SMIL clock starts.
          dangerouslySetInnerHTML={{ __html: flight.markup }}
        />
      ) : null}
    </div>
  );
}
