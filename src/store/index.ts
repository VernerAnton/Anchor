import { createLocalRepository } from './localRepository';
import { getSyncKey, LOCAL_USER_ID } from './identity';
import { hasFirebaseConfig } from './firebaseConfig';
import type { AnchorRepository } from './repository';

/**
 * The app's one store, chosen once at boot before anything renders.
 *
 * No sync key (or no Firebase config) → the localStorage backend, exactly as
 * before. Key + config → Firestore, loaded via dynamic import so the SDK's
 * weight never reaches people running purely local.
 *
 * `repository` is a live binding: main.tsx awaits `initRepository()` before
 * mounting React, so every consumer sees the chosen backend and nothing ever
 * observes it half-initialised. Switching backends is a page reload by design
 * — the moment of switching is rare (entering a sync key), and a clean boot
 * beats every subscription in the app learning to re-home itself.
 */
export let repository: AnchorRepository;

export type SyncMode = 'local' | 'cloud';

export async function initRepository(): Promise<SyncMode> {
  const key = getSyncKey();
  if (key && hasFirebaseConfig()) {
    try {
      const { createFirestoreRepository } = await import('./firestoreRepository');
      repository = createFirestoreRepository(key);
      return 'cloud';
    } catch (error) {
      console.warn('Cloud backend failed to start; running local:', error);
    }
  }
  repository = createLocalRepository(LOCAL_USER_ID);
  return 'local';
}

export type { AnchorRepository, Unsubscribe } from './repository';
