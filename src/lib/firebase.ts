import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export function firebaseConfigStatus(): {
  ok: boolean;
  missing: string[];
} {
  const missing = REQUIRED_ENV.filter((key) => !import.meta.env[key]);
  return { ok: missing.length === 0, missing };
}

export const firebaseReady = firebaseConfigStatus().ok;

// When config is missing, fall back to non-empty placeholders so the Firebase
// SDK can initialize without throwing (e.g. getAuth throws on an empty API key).
// The app still renders (showing a config warning) and any auth/db call fails
// clearly until real env vars are provided.
const PLACEHOLDER = "missing";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || PLACEHOLDER,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${PLACEHOLDER}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || PLACEHOLDER,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${PLACEHOLDER}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || PLACEHOLDER,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || PLACEHOLDER,
};

const app: FirebaseApp = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
