import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// These values identify the Firebase project; they are not secrets (access is
// controlled by the Firestore rules). They come from the build environment:
// `.env.local` while developing, repository variables in the GitHub Actions deploy.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const ENV_NAMES = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

export const missingConfig = Object.keys(ENV_NAMES)
  .filter((key) => !config[key])
  .map((key) => ENV_NAMES[key]);

export const isFirebaseConfigured = missingConfig.length === 0;

let auth = null;
let db = null;

if (isFirebaseConfigured) {
  const app = initializeApp(config);
  auth = getAuth(app);
  // Makes Firebase's own e-mails (password reset) come in Portuguese.
  auth.languageCode = "pt-BR";

  try {
    // Keeps a copy of the data in IndexedDB so the app still opens and accepts
    // changes offline; they are sent to the server when the connection returns.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn("Cache offline indisponível, usando só a memória:", err);
    db = getFirestore(app);
  }
}

export { auth, db };
