/**
 * College list for the home page marquee.
 *
 * Logos are the pen's full-colour marks, resized to the 48px strip
 * (3× for retina) and committed under `src/assets/unis`. The strip does
 * not call a logo CDN at runtime.
 */
import type { CollegeMarqueeItem } from "../types/campaign";
import babson from "../assets/unis/babson.webp";
import berkeley from "../assets/unis/berkeley.webp";
import brown from "../assets/unis/brown.webp";
import caltech from "../assets/unis/caltech.webp";
import columbia from "../assets/unis/columbia.webp";
import cornell from "../assets/unis/cornell.webp";
import dartmouth from "../assets/unis/dartmouth.webp";
import duke from "../assets/unis/duke.webp";
import harvard from "../assets/unis/harvard.webp";
import jhu from "../assets/unis/jhu.webp";
import michigan from "../assets/unis/michigan.webp";
import mit from "../assets/unis/mit.webp";
import northwestern from "../assets/unis/northwestern.webp";
import princeton from "../assets/unis/princeton.webp";
import rice from "../assets/unis/rice.webp";
import stanford from "../assets/unis/stanford.webp";
import uchicago from "../assets/unis/uchicago.webp";
import ucla from "../assets/unis/ucla.webp";
import unc from "../assets/unis/unc.webp";
import upenn from "../assets/unis/upenn.webp";
import usc from "../assets/unis/usc.webp";
import vanderbilt from "../assets/unis/vanderbilt.webp";
import yale from "../assets/unis/yale.webp";

/**
 * Max width of a wide wordmark as a fraction of the square logo box.
 * 160% equals the tile, so nothing wider can leave the cell. Each cap is
 * the largest width that keeps the letter height near half a seal.
 * Percent strings stay literal so Tailwind can see them.
 */
const WIDE_WORDMARK = {
  mit: "max-w-[90%]",
  duke: "max-w-[130%]",
  babson: "max-w-[160%]",
  caltech: "max-w-[160%]",
} as const;

/** Ordered schools duplicated in the marquee animation for seamless scroll. */
export const COLLEGES: CollegeMarqueeItem[] = [
  { name: "Princeton", domain: "princeton.edu", logoSrc: princeton },
  { name: "MIT", domain: "mit.edu", logoSrc: mit, logoClassName: WIDE_WORDMARK.mit },
  { name: "Harvard", domain: "harvard.edu", logoSrc: harvard },
  { name: "Stanford", domain: "stanford.edu", logoSrc: stanford },
  { name: "Yale", domain: "yale.edu", logoSrc: yale },
  { name: "Columbia", domain: "columbia.edu", logoSrc: columbia },
  { name: "UPenn", domain: "upenn.edu", logoSrc: upenn },
  {
    name: "Caltech",
    domain: "caltech.edu",
    logoSrc: caltech,
    logoClassName: WIDE_WORDMARK.caltech,
  },
  { name: "Johns Hopkins", domain: "jhu.edu", logoSrc: jhu },
  { name: "Dartmouth", domain: "dartmouth.edu", logoSrc: dartmouth },
  { name: "UChicago", domain: "uchicago.edu", logoSrc: uchicago },
  { name: "Northwestern", domain: "northwestern.edu", logoSrc: northwestern },
  { name: "Brown", domain: "brown.edu", logoSrc: brown },
  { name: "Vanderbilt", domain: "vanderbilt.edu", logoSrc: vanderbilt },
  { name: "Cornell", domain: "cornell.edu", logoSrc: cornell },
  { name: "Rice", domain: "rice.edu", logoSrc: rice },
  { name: "UC Berkeley", domain: "berkeley.edu", logoSrc: berkeley },
  { name: "UCLA", domain: "ucla.edu", logoSrc: ucla },
  { name: "UMichigan", domain: "umich.edu", logoSrc: michigan },
  { name: "Duke", domain: "duke.edu", logoSrc: duke, logoClassName: WIDE_WORDMARK.duke },
  { name: "USC", domain: "usc.edu", logoSrc: usc },
  { name: "UNC", domain: "unc.edu", logoSrc: unc },
  {
    name: "Babson",
    domain: "babson.edu",
    logoSrc: babson,
    logoClassName: WIDE_WORDMARK.babson,
  },
];
