import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { readFirebaseConfig } from './firebaseConfig';

/**
 * Firestore init, ported from the working app's sync layer.
 *
 * Only ever loaded via dynamic import, and only when a sync key is set — the
 * local-only app never pays for the SDK.
 *
 * `persistentLocalCache` is the offline story: writes made with no network are
 * durably queued in IndexedDB by the SDK itself and replayed on reconnect,
 * instead of being lost when the app closes before a flush. The multi-tab
 * manager keeps every open tab on one shared cache and queue.
 *
 * `ignoreUndefinedProperties` is belt-and-braces from a bug the other app hit:
 * Firestore rejects an ENTIRE write if any field is undefined, which left
 * entries visible locally but silently never synced. Anchor's types already
 * make every absent value an explicit null, so this should never trigger —
 * but if a stray undefined does slip in, dropping the field beats losing the
 * whole write.
 */
export function createDb() {
  const config = readFirebaseConfig();
  if (!config) {
    throw new Error('Firebase config missing — check VITE_FIREBASE_* in .env.local');
  }
  const app = initializeApp(config);
  return initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
}
