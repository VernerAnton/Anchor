/**
 * Document addresses, written once and consumed by both backends.
 *
 * These return Firestore path segments — `doc(db, ...pathDoc(uid, date))` is a
 * valid call. The localStorage backend joins the same segments with colons. One
 * definition of where a document lives means swapping backends can't silently
 * relocate anything.
 */

/** 2 added the task library: Point.taskId and Point.projectId. */
export const SCHEMA_VERSION = 2;

const LOCAL_PREFIX = 'anchor:v1';

export function pathsCollection(userId: string): string[] {
  return ['users', userId, 'paths'];
}

export function pathDoc(userId: string, date: string): string[] {
  return [...pathsCollection(userId), date];
}

export function daysCollection(userId: string): string[] {
  return ['users', userId, 'days'];
}

export function dayDoc(userId: string, date: string): string[] {
  return [...daysCollection(userId), date];
}

export function tasksCollection(userId: string): string[] {
  return ['users', userId, 'tasks'];
}

export function taskDoc(userId: string, id: string): string[] {
  return [...tasksCollection(userId), id];
}

export function projectsCollection(userId: string): string[] {
  return ['users', userId, 'projects'];
}

export function projectDoc(userId: string, id: string): string[] {
  return [...projectsCollection(userId), id];
}

export function settingsDoc(userId: string): string[] {
  return ['users', userId, 'settings', 'app'];
}

/** localStorage has no collections, so a document path becomes a flat key. */
export function localKey(segments: string[]): string {
  return `${LOCAL_PREFIX}:${segments.join(':')}`;
}
