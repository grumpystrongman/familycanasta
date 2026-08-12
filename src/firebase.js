import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const required = ["apiKey", "authDomain", "projectId", "appId"];
const missing = required.filter(
  (key) => !firebaseConfig[key] || firebaseConfig[key] === "replace_me"
);

export const firebaseReady = missing.length === 0;
export const firebaseMissing = missing;

let app;
let auth;
let db;
let analytics = null;
let anonymousAuthPromise = null;

if (firebaseReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);

  if (typeof window !== "undefined" && firebaseConfig.measurementId) {
    analyticsIsSupported()
      .then((supported) => {
        if (supported) analytics = getAnalytics(app);
      })
      .catch(() => {
        // Analytics is optional and must never block gameplay.
      });
  }
}

export { app, auth, db, analytics, firebaseConfig };

export function ensureAnonymousAuth() {
  if (!firebaseReady) {
    return Promise.reject(
      new Error(`Firebase configuration is missing: ${firebaseMissing.join(", ")}`)
    );
  }

  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  // Several Party Stage hooks can ask for auth at nearly the same time (initial
  // page bootstrap plus a quick Host/Join tap). Keep those calls on one promise
  // so mobile browsers never race multiple anonymous sign-ins against auth-state
  // restoration.
  if (!anonymousAuthPromise) {
    anonymousAuthPromise = (async () => {
      if (typeof auth.authStateReady === "function") await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser;
      const credential = await signInAnonymously(auth);
      return credential.user;
    })().finally(() => {
      anonymousAuthPromise = null;
    });
  }

  return anonymousAuthPromise;
}
