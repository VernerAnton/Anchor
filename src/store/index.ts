import { createLocalRepository } from './localRepository';
import { getSyncKey, LOCAL_USER_ID } from './identity';
import { hasFirebaseConfig } from './firebaseConfig';
import type { AnchorRepository } from './repository';

/**
 * The app's one store, chosen once at boot before anything renders.
 *
 * No sync key (or no Firebase config in this build) → localStorage. Key and
 * config → Firestore, loaded by dynamic import so the SDK's weight never
 * reaches anyone running purely local.
 *
 * `repository` is a live binding: main.tsx awaits `initRepository()` before
 * mounting React, so nothing ever sees it half-chosen. Switching backends is a
 * reload by design — the moment is rare (entering a key), and a clean boot
 * beats every subscription in the app learning to re-home itself.
 */
export let repository: AnchorRepository = createLocalRepository(LOCAL_USER_ID);

export type SyncMode = 'local' | 'cloud';
export let syncMode: SyncMode = 'local';

export async function initRepository(): Promise<SyncMode> {
  const key = getSyncKey();
  if (key && hasFirebaseConfig()) {
    try {
      const { createFirestoreRepository } = await import('./firestoreRepository');
      repository = createFirestoreRepository(key);
      syncMode = 'cloud';
    } catch (error) {
      console.warn('Cloud sync failed to start; running on this device only:', error);
    }
  }
  return syncMode;
}

export type { AnchorRepository, SyncStatus, Unsubscribe } from './repository';
