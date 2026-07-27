/**
 * The single seam between the app and whoever it belongs to.
 *
 * Today there is one user and the id is a constant. When real sync lands, this
 * is the only place that changes: Firebase Auth (or anonymous auth) resolves a
 * uid, the app waits for it, and the repository gets constructed with it. Every
 * storage path is already namespaced by this value, so nothing downstream has
 * to move.
 */
const LOCAL_USER_ID = 'local';

export function getUserId(): string {
  return LOCAL_USER_ID;
}
