/**
 * Firebase client bootstrap for features that need Firestore (waitlist lead capture).
 * Env-driven keys; shared `db` instance for `collection` / `addDoc` calls.
 *
 * Collections (create rules in console to allow public `create` if forms are unauthenticated):
 * - `brand_waitlist` — full-page brand waitlist (`/waitlist`) and home when user picks Brand.
 * - `org_waitlist` — home waitlist when user picks Student organization (`submitterName`, `orgName`, …).
 */
import { initializeApp } from "firebase/app";
import type { FirebaseOptions } from "firebase/app";
import type { DocumentData } from "firebase/firestore";
import { getFirestore, serverTimestamp } from "firebase/firestore";

/** Top-level Firestore collection ids used by this app. */
export const FIRESTORE_COLLECTIONS = {
  brandWaitlist: "brand_waitlist",
  orgWaitlist: "org_waitlist",
} as const;

/**
 * Single shape for every `brand_waitlist` write (home “Brand” path and `/waitlist`).
 * Home passes an empty `details` string when that field is not collected.
 */
export function buildBrandWaitlistSubmission(fields: {
  submitterName: string;
  brandName: string;
  email: string;
  details: string;
}): DocumentData {
  return {
    submitterName: fields.submitterName,
    brandName: fields.brandName,
    email: fields.email,
    details: fields.details,
    createdAt: serverTimestamp(),
  };
}

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: "bringthebuzzov.firebasestorage.app",
  messagingSenderId: "665157934695",
  appId: "1:665157934695:web:2996bad9caf4e9c80d3ec2",
  measurementId: "G-TX9XVC34MR",
};

const app = initializeApp(firebaseConfig);

/** Firestore database used by waitlist lead capture and other serverless writes. */
export const db = getFirestore(app);
