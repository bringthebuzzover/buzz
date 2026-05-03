/**
 * College list for the home page marquee: Ivy logos from `src/assets/ivies`, others use Clearbit/icon fallbacks in `Marquee`.
 */
import type { CollegeMarqueeItem } from "../types/campaign";
import brown from "../assets/unis/brown.png";
import columbia from "../assets/unis/columbia.png";
import cornell from "../assets/unis/cornell.png";
import dartmouth from "../assets/unis/dartmouth.png";
import harvard from "../assets/unis/harvard.png";
import princeton from "../assets/unis/princeton.png";
import upenn from "../assets/unis/upenn.png";
import yale from "../assets/unis/yale.png";
import vanderbilt from "../assets/unis/vanderbilt.png";
import michigan from "../assets/unis/michigan.png";
import mit from "../assets/unis/mit.png";
import uchicago from "../assets/unis/uchicago.png";

/** Ordered schools duplicated in the marquee animation for seamless scroll. */
export const COLLEGES: CollegeMarqueeItem[] = [
  { name: "Princeton", domain: "princeton.edu", logoSrc: princeton },
  { name: "MIT", domain: "mit.edu", logoSrc: mit },
  { name: "Harvard", domain: "harvard.edu", logoSrc: harvard },
  { name: "Stanford", domain: "stanford.edu" },
  { name: "Yale", domain: "yale.edu", logoSrc: yale },
  { name: "Columbia", domain: "columbia.edu", logoSrc: columbia },
  { name: "UPenn", domain: "upenn.edu", logoSrc: upenn },
  { name: "Caltech", domain: "caltech.edu" },
  { name: "Johns Hopkins", domain: "jhu.edu" },
  { name: "Dartmouth", domain: "dartmouth.edu", logoSrc: dartmouth },
  { name: "UChicago", domain: "uchicago.edu", logoSrc: uchicago },
  { name: "Northwestern", domain: "northwestern.edu" },
  { name: "Brown", domain: "brown.edu", logoSrc: brown },
  { name: "Vanderbilt", domain: "vanderbilt.edu", logoSrc: vanderbilt },
  { name: "Cornell", domain: "cornell.edu", logoSrc: cornell },
  { name: "Rice", domain: "rice.edu" },
  { name: "UC Berkeley", domain: "berkeley.edu" },
  { name: "UCLA", domain: "ucla.edu" },
  { name: "UMichigan", domain: "umich.edu", logoSrc: michigan },
  { name: "Duke", domain: "duke.edu" },
  { name: "USC", domain: "usc.edu" },
  { name: "UNC", domain: "unc.edu" },
  { name: "Babson", domain: "babson.edu" },
];
