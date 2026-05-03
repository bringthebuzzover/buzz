/**
 * Firebase client bootstrap for features that need Firestore (e.g. brand waitlist form).
 * Env-driven keys; shared `db` instance for `collection` / `addDoc` calls.
 */
import { initializeApp } from "firebase/app";
import type { FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

/** Firestore database used by waitlist and other serverless writes. */
export const db = getFirestore(app);
