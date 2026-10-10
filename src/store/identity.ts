/**
 * Who this data belongs to — the sync-key model, from the owner's working app.
 *
 * No accounts and no sign-in: a user-chosen key is the identity, and the same
 * key on another device means the same data. No key means the app runs purely
 * local, which is a full mode of the app rather than a degraded one.
 *
 * The storage name is `v3`: a device that ran the previous build may still
 * carry its `v2` key, and auto-connecting this build with it would skip the
 * guarded push of this device's local data. Connecting is always a deliberate
 * step through Settings.
 */

const SYNC_KEY_STORAGE = 'anchor:v3:sync-key';

/** The uid used for purely local storage, when no sync key is set. */
export const LOCAL_USER_ID = 'local';

export function getSyncKey(): string {
  try {
    return localStorage.getItem(SYNC_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setSyncKey(key: string): void {
  if (key) localStorage.setItem(SYNC_KEY_STORAGE, key);
  else localStorage.removeItem(SYNC_KEY_STORAGE);
}
