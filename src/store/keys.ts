/**
 * Document addresses, written once and consumed by every backend.
 *
 * These return Firestore path segments — `doc(db, ...taskDoc(uid, id))` is a
 * valid call. The localStorage backend joins the same segments with colons. One
 * definition of where a document lives means swapping backends can't silently
 * relocate anything.
 *
 * Namespaced `v3`: devices that ran the previous build may still hold its
 * `anchor:v2:*` documents (sample tasks, path fields), and the owner confirmed
 * there is no data to preserve. A fresh namespace means this build starts
 * clean instead of inheriting them. The `users/{syncKey}/…` root is kept so the
 * existing Firestore rules apply unchanged when sync arrives.
 */

/** 1 — the to-do rebuild's model. */
export const SCHEMA_VERSION = 1;

const LOCAL_PREFIX = 'anchor:v3';

export function tasksCollection(userId: string): string[] {
  return ['users', userId, 'v3-tasks'];
}

export function taskDoc(userId: string, id: string): string[] {
  return [...tasksCollection(userId), id];
}

/** localStorage has no collections, so a document path becomes a flat key. */
export function localKey(segments: string[]): string {
  return `${LOCAL_PREFIX}:${segments.join(':')}`;
}
