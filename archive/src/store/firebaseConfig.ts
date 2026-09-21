/**
 * Reads the Firebase env config without touching the Firebase SDK.
 *
 * Deliberately a separate module from the SDK init: the app checks "is cloud
 * sync even possible?" at boot, and that check must not drag ~100kB of
 * Firestore into the bundle for people running purely local. The SDK is only
 * imported dynamically, and only when a sync key is actually set.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function readFirebaseConfig(): FirebaseConfig | null {
  const env = import.meta.env;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return Object.values(config).every((v) => typeof v === 'string' && v.length > 0)
    ? (config as FirebaseConfig)
    : null;
}

export function hasFirebaseConfig(): boolean {
  return readFirebaseConfig() !== null;
}
