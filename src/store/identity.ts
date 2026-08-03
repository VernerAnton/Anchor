/**
 * Who this data belongs to — the sync-key model, taken from the working app.
 *
 * No accounts and no auth: a user-chosen key is the identity, and the same key
 * entered on another device means the same data. No key means the app runs
 * purely local, which is a full mode of the app rather than a degraded one.
 */

const SYNC_KEY_STORAGE = 'anchor:sync-key';

/** The uid used for purely-local storage, when no sync key is set. */
export const LOCAL_USER_ID = 'local';

export function getSyncKey(): string {
  try {
    return localStorage.getItem(SYNC_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setSyncKey(key: string): void {
  if (key) {
    localStorage.setItem(SYNC_KEY_STORAGE, key);
  } else {
    localStorage.removeItem(SYNC_KEY_STORAGE);
  }
}
