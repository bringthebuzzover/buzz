/**
 * Decorative flight over the “How to Bring the Buzz Over” heading.
 *
 * The bee and the coral dots share one 10s document clock (`dur="10s"`).
 * Trail dots use a negative `begin` so they are already behind the bee
 * when the page loads and stay attached for every repeat. The markup is
 * parsed as SVG (not built by React) so that SMIL actually starts.
 * prefers-reduced-motion parks a still bee at the top-right of the title.
 */
import { publicLogo } from "../../utils/publicLogo";
import { tailwindThemeExtend } from "../../theme/palette";

const BEE_SRC = publicLogo("bee.svg");
const CORAL = tailwindThemeExtend.colors.buzz.coral;
const LOOP_SECONDS = 10;

/**
 * Logo head points up-right (~50° above +x). Clockwise 50° lays that
 * nose on +x, which animateMotion rotate="auto" then aims along the path.
 * Body-mass center of bee.svg sits at about (45.4%, 58.6%) of the image.
 */
const NOSE_CLOCKWISE_DEG = 50;
const BODY_X = 0.454;
const BODY_Y = 0.586;

/**
 * Word boxes were measured on the live heading (system semibold,
 * tracking-tight). Wide viewBox 0 0 1000 360 is centered on the one-line
 * title, so y=180 is the line box. Phone viewBox 0 0 311 180 is centered
 * on the wrapped title (~375px): “Over” sits alone on line two.
 * The title wraps only below ~380px; from there up the proportions hold.
 */
const WIDE_PATH =
  "M 250 42 C 330 42 390 110 448 180 C 530 210 640 108 720 108 C 779.6 108 828 139.3 828 178 C 828 216.7 779.6 248 720 248 C 660.4 248 612 216.7 612 178 C 612 139.3 660.4 108 720 108 C 756 108 830 114 912 120 C 960 118 990 140 1016 140 C 1041.4 140 1062 160.6 1062 186 C 1062 211.4 1041.4 232 1016 232 C 990.6 232 970 211.4 970 186 C 970 160.6 990.6 140 1016 140 C 1066 140 990 236 760 238 C 540 242 360 230 180 188 C 120 148 160 42 250 42";

const NARROW_PATH =
  "M 124 18 C 145 18 158 46 170 74 C 188 96 230 48 255 48 C 273.8 48 289 58.7 289 72 C 289 85.3 273.8 96 255 96 C 236.2 96 221 85.3 221 72 C 221 58.7 236.2 48 255 48 C 267 48 200 68 156 78 C 190 76 250 70 286 76 C 294.8 76 302 83.2 302 92 C 302 100.8 294.8 108 286 108 C 277.2 108 270 100.8 270 92 C 270 83.2 277.2 76 286 76 C 304 76 290 128 190 132 C 100 136 48 100 72 36 C 88 16 100 18 124 18";

/** Seconds behind the bee. Three opacity steps, two dots each. */
const TRAIL = [
  { lag: 0.28, opacity: 0.95, scale: 1 },
  { lag: 0.52, opacity: 0.95, scale: 0.88 },
  { lag: 0.78, opacity: 0.55, scale: 0.76 },
  { lag: 1.04, opacity: 0.55, scale: 0.66 },
  { lag: 1.3, opacity: 0.26, scale: 0.56 },
  { lag: 1.56, opacity: 0.26, scale: 0.46 },
] as const;

function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function flightMarkup(opts: {
  path: string;
  pathId: string;
  bee: number;
  dot: number;
  viewBox: string;
  className: string;
}): string {
  const { path, pathId, bee, dot, viewBox, className } = opts;
  const [, , width, height] = viewBox.split(" ");
  const dots = TRAIL.map((step) => {
    const behind = (LOOP_SECONDS - step.lag).toFixed(2);
    const radius = (dot * step.scale).toFixed(2);
    return `<circle r="${radius}" fill="${CORAL}" opacity="${step.opacity}"><animateMotion dur="${LOOP_SECONDS}s" repeatCount="indefinite" begin="-${behind}s" calcMode="linear" rotate="0"><mpath href="#${pathId}" xlink:href="#${pathId}"/></animateMotion></circle>`;
  }).join("");
  const beeUrl = attr(BEE_SRC);
  // Bee begins at 0s. Dots begin a fraction of the same 10s earlier so the
  // trail is already behind the bee. Both repeat on that one duration.
  return `<svg viewBox="${viewBox}" width="${width}" height="${height}" class="${className}" overflow="visible" focusable="false"><path id="${pathId}" d="${path}" fill="none"/>${dots}<g><animateMotion dur="${LOOP_SECONDS}s" repeatCount="indefinite" begin="0s" calcMode="linear" rotate="auto"><mpath href="#${pathId}" xlink:href="#${pathId}"/></animateMotion><g transform="rotate(${NOSE_CLOCKWISE_DEG})"><image href="${beeUrl}" xlink:href="${beeUrl}" x="${(-bee * BODY_X).toFixed(2)}" y="${(-bee * BODY_Y).toFixed(2)}" width="${bee}" height="${bee}"/></g></g></svg>`;
}

const NARROW_SVG = flightMarkup({
  path: NARROW_PATH,
  pathId: "home-bee-path-narrow",
  bee: 19,
  dot: 3.3,
  viewBox: "0 0 311 180",
  className:
    "pointer-events-none absolute left-0 top-1/2 h-auto w-full -translate-y-1/2 overflow-visible min-[380px]:hidden",
});

const WIDE_SVG = flightMarkup({
  path: WIDE_PATH,
  pathId: "home-bee-path-wide",
  bee: 62,
  dot: 7.6,
  viewBox: "0 0 1000 360",
  className:
    "pointer-events-none absolute left-0 top-1/2 h-auto w-full -translate-y-1/2 overflow-visible hidden min-[380px]:block",
});

export default function HomeFlyingBee() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
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
