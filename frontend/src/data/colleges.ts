/**
 * College list for the home page marquee.
 *
 * Logos are committed files under `src/assets/unis` — the strip does not call
 * a logo CDN at runtime. Marks are public-domain seals and wordmarks from
 * Wikimedia Commons, except Babson (`File:Babson-logo.png`, CC BY-SA 4.0).
 */
import type { CollegeMarqueeItem } from "../types/campaign";
import babson from "../assets/unis/babson.png";
import berkeley from "../assets/unis/berkeley.png";
import brown from "../assets/unis/brown.png";
import caltech from "../assets/unis/caltech.png";
import columbia from "../assets/unis/columbia.png";
import cornell from "../assets/unis/cornell.png";
import dartmouth from "../assets/unis/dartmouth.png";
import duke from "../assets/unis/duke.png";
import harvard from "../assets/unis/harvard.png";
import jhu from "../assets/unis/jhu.png";
import michigan from "../assets/unis/michigan.png";
import mit from "../assets/unis/mit.png";
import northwestern from "../assets/unis/northwestern.png";
import princeton from "../assets/unis/princeton.png";
import rice from "../assets/unis/rice.png";
import stanford from "../assets/unis/stanford.png";
import uchicago from "../assets/unis/uchicago.png";
import ucla from "../assets/unis/ucla.png";
import unc from "../assets/unis/unc.png";
import upenn from "../assets/unis/upenn.png";
import usc from "../assets/unis/usc.png";
import vanderbilt from "../assets/unis/vanderbilt.png";
import yale from "../assets/unis/yale.png";

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
