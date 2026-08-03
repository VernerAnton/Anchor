import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Configuration loaded from Environment Variables
// This keeps your keys out of the code and safe in .env.local
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Enable persistent (IndexedDB) offline cache so writes are durably queued and
// replayed on reconnect instead of being lost when the app goes offline or is
// closed before a write flushes. Multi-tab manager keeps tabs in sync.
//
// ignoreUndefinedProperties: Firestore rejects an ENTIRE write if any field is
// undefined (e.g. libraryItemId on a brand-new food, tags on an untagged
// library item). localStorage is written before the cloud push, so a rejected
// write left entries visible locally but never synced — they vanished when the
// next successful sync replaced local state. Dropping undefined fields instead
// matches JSON.stringify behavior used for localStorage.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});