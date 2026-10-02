import { createLocalRepository } from './localRepository';
import type { AnchorRepository } from './repository';

/**
 * The app's one store, chosen once at boot before anything renders.
 *
 * Local-only until phase 4, when a sync key selects the Firestore backend
 * behind this same interface (see `archive/src/store/index.ts` for the shape
 * that takes). Nothing outside this folder knows which backend it's talking
 * to.
 */

/** The uid used for purely local storage, when no sync key is set. */
export const LOCAL_USER_ID = 'local';

export const repository: AnchorRepository = createLocalRepository(LOCAL_USER_ID);

export type { AnchorRepository, Unsubscribe } from './repository';
