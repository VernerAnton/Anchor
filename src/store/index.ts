import { createLocalRepository } from './localRepository';
import { getUserId } from './identity';
import type { AnchorRepository } from './repository';

/**
 * The app's one store.
 *
 * Swapping to live sync is this line: `createFirestoreRepository(uid)`. Nothing
 * else in the app names a backend.
 */
export const repository: AnchorRepository = createLocalRepository(getUserId());

export type { AnchorRepository, Unsubscribe } from './repository';
