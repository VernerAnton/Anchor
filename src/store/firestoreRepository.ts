import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Project, Task } from '../types/task';
import type { DayLog } from '../types/path';
import type { AnchorRepository, Unsubscribe } from './repository';
import {
  dayLogDoc,
  dayLogsCollection,
  pathDoc,
  projectDoc,
  projectsCollection,
  settingsDoc,
  taskDoc,
  tasksCollection,
} from './keys';
import { parseDayLog, parsePathPattern, parseProject, parseSettings, parseTask } from './schemas';
import { createDb } from './firebase';

/**
 * Firestore behind the same interface the local backend implements.
 *
 * Ported from the working app's sync layer, with one deliberate divergence.
 * That app kept its own localStorage mirror, used snapshots only for *remote*
 * changes, and therefore skipped `hasPendingWrites` docs (its own echoes).
 * Anchor has no separate mirror — the UI renders straight from these
 * subscriptions — so pending-write snapshots are wanted here: they ARE the
 * optimistic local update, and with the persistent cache they keep the app
 * fully live while offline.
 *
 * What is kept from the proven pattern:
 *  - the per-document version guard: a snapshot carrying a lower version than
 *    one already delivered is a stale echo and is dropped,
 *  - deletions resolved before any version check,
 *  - every inbound document validated before it can touch app state.
 */
export function createFirestoreRepository(syncKey: string): AnchorRepository {
  const db: Firestore = createDb();

  const ref = (segments: string[]) => {
    const [root, ...rest] = segments;
    return doc(db, root!, ...rest);
  };

  /** Highest version delivered per document, for stale-echo rejection. */
  const delivered = new Map<string, number>();

  const guard = (key: string, version: number): boolean => {
    const seen = delivered.get(key) ?? -1;
    if (version < seen) return false;
    delivered.set(key, version);
    return true;
  };

  const subscribeDoc = <T extends { version: number }>(
    segments: string[],
    parseFn: (data: unknown, context: string) => T | null,
    cb: (value: T | null) => void,
  ): Unsubscribe => {
    const key = segments.join('/');
    return onSnapshot(
      ref(segments),
      { includeMetadataChanges: true },
      (snap) => {
        // Deletion first, bypassing the version check — mirroring the working
        // app, where a deleted doc has no version to compare.
        if (!snap.exists()) {
          delivered.delete(key);
          cb(null);
          return;
        }
        const parsed = parseFn(snap.data(), key);
        if (parsed === null) return;
        if (!guard(key, parsed.version)) return;
        cb(parsed);
      },
      (error) => console.warn(`Cloud sync error (${key}):`, error),
    );
  };

  /**
   * Whole-collection listener for the id-keyed library. No range: a personal
   * task list is small enough to hold entirely, and holding it entirely is what
   * lets the views filter and group without a round trip per keystroke.
   */
  const subscribeCollection = <T>(
    segments: string[],
    parseFn: (data: unknown, context: string) => T | null,
    cb: (items: T[]) => void,
  ): Unsubscribe =>
    onSnapshot(
      collection(db, segments[0]!, ...segments.slice(1)),
      { includeMetadataChanges: true },
      (snap) => {
        cb(
          snap.docs
            .map((d) => parseFn(d.data(), `${segments.join('/')}/${d.id}`))
            .filter((item): item is T => item !== null),
        );
      },
      (error) => console.warn(`Cloud sync error (${segments.join('/')}):`, error),
    );

  const readCollection = async <T>(
    segments: string[],
    parseFn: (data: unknown, context: string) => T | null,
  ): Promise<T[]> => {
    const snap = await getDocs(collection(db, segments[0]!, ...segments.slice(1)));
    return snap.docs
      .map((d) => parseFn(d.data(), `${segments.join('/')}/${d.id}`))
      .filter((item): item is T => item !== null);
  };

  const save = async (segments: string[], value: { version: number }) => {
    // The local optimistic version is recorded before the write is in flight,
    // so an echo of an older write arriving later can never regress the UI.
    guard(segments.join('/'), value.version);
    // Whole-document set, not merge: the document is the unit of conflict, and
    // a full replace means a removed field stays removed. (The reference app
    // used merge writes because it updated per-entry maps inside its docs —
    // a granularity Anchor deliberately doesn't have.)
    await setDoc(ref(segments), value);
  };

  return {
    async getTasks() {
      return readCollection<Task>(tasksCollection(syncKey), parseTask);
    },

    subscribeTasks(cb) {
      return subscribeCollection(tasksCollection(syncKey), parseTask, cb);
    },

    async saveTask(task) {
      await save(taskDoc(syncKey, task.id), task);
    },

    async deleteTask(id) {
      delivered.delete(taskDoc(syncKey, id).join('/'));
      await deleteDoc(ref(taskDoc(syncKey, id)));
    },

    async getProjects() {
      return readCollection<Project>(projectsCollection(syncKey), parseProject);
    },

    subscribeProjects(cb) {
      return subscribeCollection(projectsCollection(syncKey), parseProject, cb);
    },

    async saveProject(project) {
      await save(projectDoc(syncKey, project.id), project);
    },

    async deleteProject(id) {
      delivered.delete(projectDoc(syncKey, id).join('/'));
      await deleteDoc(ref(projectDoc(syncKey, id)));
    },

    async getPathPattern() {
      const snap = await getDoc(ref(pathDoc(syncKey)));
      return snap.exists() ? parsePathPattern(snap.data(), 'getPathPattern') : null;
    },

    subscribePathPattern(cb) {
      return subscribeDoc(pathDoc(syncKey), parsePathPattern, cb);
    },

    async savePathPattern(pattern) {
      await save(pathDoc(syncKey), pattern);
    },

    async getDayLogs() {
      return readCollection<DayLog>(dayLogsCollection(syncKey), parseDayLog);
    },

    subscribeDayLogs(cb) {
      return subscribeCollection(dayLogsCollection(syncKey), parseDayLog, cb);
    },

    async saveDayLog(log) {
      await save(dayLogDoc(syncKey, log.date), log);
    },

    async getSettings() {
      const snap = await getDoc(ref(settingsDoc(syncKey)));
      return snap.exists() ? parseSettings(snap.data(), 'getSettings') : null;
    },

    subscribeSettings(cb) {
      return subscribeDoc(settingsDoc(syncKey), parseSettings, cb);
    },

    async saveSettings(settings) {
      await save(settingsDoc(syncKey), settings);
    },
  };
}
