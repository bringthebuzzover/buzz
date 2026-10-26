/**
 * Decorative flight over the “How to Bring the Buzz Over” heading.
 *
 * One 16s document clock (`dur="16s"`, `calcMode="paced"`) drives the bee
 * and the bright trail, so they stay attached and move at constant speed.
 * Waypoints become a periodic cubic spline: every join, including the loop
 * seam, matches position, tangent, and curvature. A faint dotted copy of
 * that whole route sits under a shorter three-step trail.
 * The markup is parsed as SVG (not built by React) so SMIL actually starts.
 * prefers-reduced-motion parks a still bee at the top-right of the title.
 */
import { publicLogo } from "../../utils/publicLogo";
import { tailwindThemeExtend } from "../../theme/palette";

const BEE_SRC = publicLogo("bee.svg");
const CORAL = tailwindThemeExtend.colors.buzz.coral;
const LOOP_SECONDS = 16;

/**
 * Logo head points up-right (~50° above +x). Clockwise 50° lays that
 * nose on +x, which animateMotion rotate="auto" then aims along the path.
 * Body-mass center of bee.svg sits at about (45.4%, 58.6%) of the image.
 */
const NOSE_CLOCKWISE_DEG = 50;
const BODY_X = 0.454;
const BODY_Y = 0.586;

type Pt = [number, number];
type Bezier = { p0: Pt; p1: Pt; p2: Pt; p3: Pt };

/**
 * Word boxes were measured on the live heading (system semibold,
 * tracking-tight). Wide viewBox 0 0 1000 360 is centered on the one-line
 * title, so y=180 is the line box. Phone viewBox 0 0 311 180 is centered
 * on the wrapped title (~375px): “Over” sits alone on line two.
 * The title wraps only below ~380px; from there up the proportions hold.
 * Screen-clockwise degrees: 0 right, 90 down, 180 left, 270 up.
 */
function ring(cx: number, cy: number, rx: number, ry: number, fromDeg: number, toDeg: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return pts;
}

const WIDE_POINTS: Pt[] = [
  [236, 52],
  [310, 64],
  [378, 108],
  [430, 158],
  [452, 188],
  [500, 208],
  [560, 188],
  [630, 142],
  [688, 112],
  ...ring(720, 178, 108, 70, 268, 268 + 360, 12),
  [724, 96],
  [800, 108],
  [870, 114],
  [940, 124],
  [990, 136],
  ...ring(1016, 186, 46, 46, 268, 268 + 330, 11),
  [990, 196],
  [950, 210],
  [860, 212],
  [750, 208],
  [630, 200],
  [510, 188],
  [400, 168],
  [310, 136],
  [250, 100],
  [214, 70],
];

const NARROW_POINTS: Pt[] = [
  [108, 28],
  [134, 42],
  [156, 60],
  [170, 78],
  [196, 96],
  [224, 92],
  ...ring(255, 72, 32, 20, 120, 120 + 360, 10),
  [228, 102],
  [186, 98],
  [148, 104],
  [118, 114],
  [114, 124],
  [140, 128],
  [178, 124],
  [216, 116],
  [248, 110],
  ...ring(284, 108, 15, 15, 170, 170 + 360, 8),
  [266, 122],
  [214, 126],
  [156, 124],
  [100, 114],
  [68, 96],
  [64, 62],
  [84, 36],
];

/** Seconds behind the bee. Three opacity steps, two dots each. */
const TRAIL = [
  { lag: 0.4, opacity: 0.95, scale: 1 },
  { lag: 0.75, opacity: 0.95, scale: 0.9 },
  { lag: 1.15, opacity: 0.55, scale: 0.78 },
  { lag: 1.55, opacity: 0.55, scale: 0.68 },
  { lag: 2.0, opacity: 0.26, scale: 0.58 },
  { lag: 2.45, opacity: 0.26, scale: 0.48 },
] as const;

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
    m * m * m * b.p0[axis] +
    3 * m * m * u * b.p1[axis] +
    3 * m * u * u * b.p2[axis] +
    u * u * u * b.p3[axis];
  return [c(0), c(1)];
}

/** Evenly spaced samples of the closed route, for the faint dotted path. */
function routeDots(beziers: Bezier[], spacing: number): Pt[] {
  const dense: Pt[] = [beziers[0].p0];
  for (const b of beziers) {
    for (let s = 1; s <= 16; s++) dense.push(pointAt(b, s / 16));
  }
  const dots: Pt[] = [dense[0]];
  let acc = 0;
  let prev = dense[0];
  for (let i = 1; i < dense.length; i++) {
    acc += Math.hypot(dense[i][0] - prev[0], dense[i][1] - prev[1]);
    prev = dense[i];
    if (acc >= spacing) {
      dots.push(dense[i]);
      acc = 0;
    }
  }
  const first = dots[0];
  const last = dots[dots.length - 1];
  if (dots.length > 1 && Math.hypot(last[0] - first[0], last[1] - first[1]) < spacing * 0.65) {
    dots.pop();
  }
  return dots;
}

function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function flightMarkup(opts: {
  points: Pt[];
  pathId: string;
  bee: number;
  dot: number;
  routeSpacing: number;
  routeRadius: number;
  viewBox: string;
  className: string;
}): string {
  const { points, pathId, bee, dot, routeSpacing, routeRadius, viewBox, className } = opts;
  const beziers = splineBeziers(points);
  const path = pathData(beziers);
  const [, , width, height] = viewBox.split(" ");
  const route = routeDots(beziers, routeSpacing)
    .map(
      ([x, y]) =>
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${routeRadius.toFixed(2)}" fill="${CORAL}" opacity="0.2"/>`,
    )
    .join("");
  const trail = TRAIL.map((step) => {
    const behind = (LOOP_SECONDS - step.lag).toFixed(2);
    const radius = (dot * step.scale).toFixed(2);
    return `<circle r="${radius}" fill="${CORAL}" opacity="${step.opacity}"><animateMotion dur="${LOOP_SECONDS}s" repeatCount="indefinite" begin="-${behind}s" calcMode="paced" rotate="0"><mpath href="#${pathId}" xlink:href="#${pathId}"/></animateMotion></circle>`;
  }).join("");
  const beeUrl = attr(BEE_SRC);
  return `<svg viewBox="${viewBox}" width="${width}" height="${height}" class="${className}" overflow="visible" focusable="false"><path id="${pathId}" d="${path}" fill="none"/>${route}${trail}<g><animateMotion dur="${LOOP_SECONDS}s" repeatCount="indefinite" begin="0s" calcMode="paced" rotate="auto"><mpath href="#${pathId}" xlink:href="#${pathId}"/></animateMotion><g transform="rotate(${NOSE_CLOCKWISE_DEG})"><image href="${beeUrl}" xlink:href="${beeUrl}" x="${(-bee * BODY_X).toFixed(2)}" y="${(-bee * BODY_Y).toFixed(2)}" width="${bee}" height="${bee}"/></g></g></svg>`;
}

const NARROW_SVG = flightMarkup({
  points: NARROW_POINTS,
  pathId: "home-bee-path-narrow",
  bee: 19,
  dot: 3.3,
  routeSpacing: 14,
  routeRadius: 2,
  viewBox: "0 0 311 180",
  className:
    "pointer-events-none absolute left-0 top-1/2 h-auto w-full -translate-y-1/2 overflow-visible min-[380px]:hidden",
});

const WIDE_SVG = flightMarkup({
  points: WIDE_POINTS,
  pathId: "home-bee-path-wide",
  bee: 62,
  dot: 7.6,
  routeSpacing: 40,
  routeRadius: 4.6,
  viewBox: "0 0 1000 360",
  className:
    "pointer-events-none absolute left-0 top-1/2 h-auto w-full -translate-y-1/2 overflow-visible hidden min-[380px]:block",
});

export default function HomeFlyingBee() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      <div
        className="motion-reduce:hidden"
        // Static decorative SVG. Parsed by the browser so the SMIL clock starts.
        dangerouslySetInnerHTML={{ __html: NARROW_SVG + WIDE_SVG }}
      />
      <img
        src={BEE_SRC}
        alt=""
        className="absolute right-0 top-0 hidden h-[19px] w-[19px] motion-reduce:block md:h-[29px] md:w-[29px]"
      />
    </div>
  );
}
