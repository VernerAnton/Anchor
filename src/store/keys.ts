/**
 * Document addresses, written once and consumed by both backends.
 *
 * These return Firestore path segments — `doc(db, ...taskDoc(uid, id))` is a
 * valid call. The localStorage backend joins the same segments with colons. One
 * definition of where a document lives means swapping backends can't silently
 * relocate anything.
 *
 * Everything is namespaced `v2`: the old app's documents may still be sitting
 * in the same Firebase project (and its `anchor:v1:*` keys on installed
 * devices), and fresh names let old and new coexist without one confusing the
 * other. The `users/{syncKey}/…` root is kept so the existing Firestore rules
 * apply unchanged.
 */

/** 1 — the rebuild's task-first model: tasks, nested projects, settings. */
export const SCHEMA_VERSION = 1;

const LOCAL_PREFIX = 'anchor:v2';

export function tasksCollection(userId: string): string[] {
  return ['users', userId, 'v2-tasks'];
}

export function taskDoc(userId: string, id: string): string[] {
  return [...tasksCollection(userId), id];
}

export function projectsCollection(userId: string): string[] {
  return ['users', userId, 'v2-projects'];
}

export function projectDoc(userId: string, id: string): string[] {
  return [...projectsCollection(userId), id];
}

export function settingsDoc(userId: string): string[] {
  return ['users', userId, 'v2-settings', 'app'];
}

/** localStorage has no collections, so a document path becomes a flat key. */
export function localKey(segments: string[]): string {
  return `${LOCAL_PREFIX}:${segments.join(':')}`;
}
