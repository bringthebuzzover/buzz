/**
 * College list for the home page marquee: Ivy logos from `src/assets/ivies`, others use Clearbit/icon fallbacks in `Marquee`.
 */
import type { CollegeMarqueeItem } from "../types/campaign";
import brown from "../assets/ivies/brown.png";
import columbia from "../assets/ivies/columbia.png";
import cornell from "../assets/ivies/cornell.png";
import dartmouth from "../assets/ivies/dartmouth.png";
import harvard from "../assets/ivies/harvard.png";
import princeton from "../assets/ivies/princeton.png";
import upenn from "../assets/ivies/upenn.png";
import yale from "../assets/ivies/yale.png";

/** Ordered schools duplicated in the marquee animation for seamless scroll. */
export const COLLEGES: CollegeMarqueeItem[] = [
  { name: "Princeton", domain: "princeton.edu", logoSrc: princeton },
  { name: "MIT", domain: "mit.edu" },
  { name: "Harvard", domain: "harvard.edu", logoSrc: harvard },
  { name: "Stanford", domain: "stanford.edu" },
  { name: "Yale", domain: "yale.edu", logoSrc: yale },
  { name: "Columbia", domain: "columbia.edu", logoSrc: columbia },
  { name: "UPenn", domain: "upenn.edu", logoSrc: upenn },
  { name: "Caltech", domain: "caltech.edu" },
  { name: "Johns Hopkins", domain: "jhu.edu" },
  { name: "Dartmouth", domain: "dartmouth.edu", logoSrc: dartmouth },
  { name: "UChicago", domain: "uchicago.edu" },
  { name: "Northwestern", domain: "northwestern.edu" },
  { name: "Brown", domain: "brown.edu", logoSrc: brown },
  { name: "Vanderbilt", domain: "vanderbilt.edu" },
  { name: "Cornell", domain: "cornell.edu", logoSrc: cornell },
  { name: "Rice", domain: "rice.edu" },
  { name: "UC Berkeley", domain: "berkeley.edu" },
  { name: "UCLA", domain: "ucla.edu" },
  { name: "UMichigan", domain: "umich.edu" },
  { name: "Duke", domain: "duke.edu" },
  { name: "USC", domain: "usc.edu" },
  { name: "UNC", domain: "unc.edu" },
  { name: "Babson", domain: "babson.edu" },
];
