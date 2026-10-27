/**
 * College list for the home page marquee. Every logo is local: older imports in `src/assets/unis`,
 * the rest in `public/colleges` (sources in `public/colleges/sources.json`).
 * Campus coordinates are the English Wikipedia article coordinates (prop=coordinates, primary).
 * Adding a school means adding its lat/lng.
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

const PUBLIC = process.env.PUBLIC_URL ?? "";
const local = (file: string): string => `${PUBLIC}/colleges/${file}`;

/** Ordered schools duplicated in the marquee animation for seamless scroll. */
export const COLLEGES: CollegeMarqueeItem[] = [
  { name: "Princeton", domain: "princeton.edu", logoSrc: princeton, lat: 40.34527778, lng: -74.65611111 },
  { name: "MIT", domain: "mit.edu", logoSrc: mit, lat: 42.3597, lng: -71.0919 },
  { name: "Harvard", domain: "harvard.edu", logoSrc: harvard, lat: 42.37444444, lng: -71.11694444 },
  { name: "Stanford", domain: "stanford.edu", logoSrc: local("stanford.png"), lat: 37.4275, lng: -122.17027778 },
  { name: "Yale", domain: "yale.edu", logoSrc: yale, lat: 41.31638889, lng: -72.92222222 },
  { name: "Columbia", domain: "columbia.edu", logoSrc: columbia, lat: 40.8075, lng: -73.96194444 },
  { name: "UPenn", domain: "upenn.edu", logoSrc: upenn, lat: 39.95194444, lng: -75.19361111 },
  { name: "Caltech", domain: "caltech.edu", logoSrc: local("caltech.svg"), lat: 34.1375, lng: -118.125 },
  { name: "Johns Hopkins", domain: "jhu.edu", logoSrc: local("jhu.png"), lat: 39.32888889, lng: -76.62027778 },
  { name: "Dartmouth", domain: "dartmouth.edu", logoSrc: dartmouth, lat: 43.70333333, lng: -72.28833333 },
  { name: "UChicago", domain: "uchicago.edu", logoSrc: uchicago, lat: 41.78972222, lng: -87.59972222 },
  { name: "Northwestern", domain: "northwestern.edu", logoSrc: local("northwestern.png"), lat: 42.05583333, lng: -87.67472222 },
  { name: "Brown", domain: "brown.edu", logoSrc: brown, lat: 41.826, lng: -71.403 },
  { name: "Vanderbilt", domain: "vanderbilt.edu", logoSrc: vanderbilt, lat: 36.1475, lng: -86.8025 },
  { name: "Cornell", domain: "cornell.edu", logoSrc: cornell, lat: 42.4492, lng: -76.4839 },
  { name: "Rice", domain: "rice.edu", logoSrc: local("rice.svg"), lat: 29.71694444, lng: -95.40277778 },
  { name: "UC Berkeley", domain: "berkeley.edu", logoSrc: local("berkeley.png"), lat: 37.8719, lng: -122.2583 },
  { name: "UCLA", domain: "ucla.edu", logoSrc: local("ucla.svg"), lat: 34.0722, lng: -118.4427 },
  { name: "UMichigan", domain: "umich.edu", logoSrc: michigan, lat: 42.27694444, lng: -83.73805556 },
  { name: "Duke", domain: "duke.edu", logoSrc: local("duke.svg"), lat: 36.00138889, lng: -78.93833333 },
  { name: "USC", domain: "usc.edu", logoSrc: local("usc.svg"), lat: 34.0206, lng: -118.2848 },
  { name: "UNC", domain: "unc.edu", logoSrc: local("unc.png"), lat: 35.90861111, lng: -79.04916667 },
  { name: "Babson", domain: "babson.edu", logoSrc: local("babson.svg"), lat: 42.29823056, lng: -71.26119167 },
];
