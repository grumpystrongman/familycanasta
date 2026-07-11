import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
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

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
          return;
        }

        try {
          const credential = await signInAnonymously(auth);
          unsubscribe();
          resolve(credential.user);
        } catch (error) {
          unsubscribe();
          reject(error);
        }
      },
      reject
    );
  });
}
