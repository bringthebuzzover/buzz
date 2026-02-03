// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "bringthebuzzov.firebasestorage.app",
  messagingSenderId: "665157934695",
  appId: "1:665157934695:web:2996bad9caf4e9c80d3ec2",
  measurementId: "G-TX9XVC34MR"
};

// Initialize Firebase ONCE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export { db };

