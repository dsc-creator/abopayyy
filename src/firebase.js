import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// A prior version of this file had these values hardcoded as fallbacks,
// which GitHub's secret scanner flagged. Don't reintroduce them — set real
// values in .env instead, and fail loudly if they're missing rather than
// silently falling back to a stale/exposed key.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Missing Firebase config — copy .env.example to .env and fill in the VITE_FIREBASE_* values."
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const functions = getFunctions(app);
// Used only by the Live Chat feature, which needs true real-time updates
// that a REST API can't give you. Everything else in this app deliberately
// goes through the api.js REST client (backed by requireAdmin-gated Vercel
// functions) instead of touching Firestore directly from the browser.
export const db = getFirestore(app);

export let analytics = null;
isSupported().then((supported) => {
  if (supported) analytics = getAnalytics(app);
});

export default app;
