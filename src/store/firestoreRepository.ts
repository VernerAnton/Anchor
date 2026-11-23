import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  waitForPendingWrites,
  type Firestore,
} from 'firebase/firestore';
import type { AnchorRepository, SyncStatus, Unsubscribe } from './repository';
import {
  labelDoc,
  labelsCollection,
  projectDoc,
  projectsCollection,
  settingsDoc,
  taskDoc,
  tasksCollection,
} from './keys';
import { parseLabel, parseProject, parseSettings, parseTask } from './schemas';
import { createDb } from './firebase';

/**
 * Firestore behind the same interface the local backend implements. Ported
 * from the archive (itself ported from the owner's working app); what it
 * already knew is kept:
 *
 *  - the per-document version guard: a snapshot carrying a lower version than
 *    one already delivered is a stale echo and is dropped — integers, never
 *    timestamps, so a device with a wrong clock can't lose data;
 *  - deletions resolved before any version check;
 *  - every inbound document validated, and invalid ones dropped with a warning;
 *  - pending-write snapshots are wanted: the UI renders straight from these
 *    subscriptions, so they ARE the optimistic local update, and with the
 *    persistent cache the app stays fully live offline.
 *
 * One deliberate change. A Firestore `setDoc` promise resolves only when the
 * *server* acknowledges the write — offline, that's not until reconnect. The
 * write itself is already applied locally and durably queued, so the app is
 * told it's done as soon as it's queued; a late refusal arrives through
 * `subscribeWriteErrors`. Awaiting the server would have left every offline
 * action looking unfinished (no Undo notice after completing a repeating task,
 * for one) until the network came back.
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

  const errorListeners = new Set<(error: unknown) => void>();
  const failed = (context: string) => (error: unknown) => {
    console.warn(`Cloud write failed (${context}):`, error);
    for (const listener of errorListeners) listener(error);
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
   * Whole-collection listener for the id-keyed library. A personal task list
   * is small enough to hold entirely, and holding it is what lets the views
   * filter and group without a round trip.
   */
  const subscribeCollection = <T extends { id: string; version: number }>(
    segments: string[],
    parseFn: (data: unknown, context: string) => T | null,
    cb: (items: T[]) => void,
  ): Unsubscribe => {
    const path = segments.join('/');
    /** The last copy delivered of each document, so a stale echo keeps the newer one. */
    const latest = new Map<string, T>();
    return onSnapshot(
      collection(db, segments[0]!, ...segments.slice(1)),
      { includeMetadataChanges: true },
      (snap) => {
        const present = new Set<string>();
        for (const d of snap.docs) {
          present.add(d.id);
          const parsed = parseFn(d.data(), `${path}/${d.id}`);
          if (parsed === null) continue;
          if (guard(`${path}/${d.id}`, parsed.version)) latest.set(d.id, parsed);
        }
        for (const id of latest.keys()) {
          if (!present.has(id)) {
            latest.delete(id);
            delivered.delete(`${path}/${id}`);
          }
        }
        cb([...latest.values()]);
      },
      (error) => console.warn(`Cloud sync error (${path}):`, error),
    );
  };

  const readCollection = async <T>(
    segments: string[],
    parseFn: (data: unknown, context: string) => T | null,
  ): Promise<T[]> => {
    const snap = await getDocsFromServer(collection(db, segments[0]!, ...segments.slice(1)));
    return snap.docs
      .map((d) => parseFn(d.data(), `${segments.join('/')}/${d.id}`))
      .filter((item): item is T => item !== null);
  };

  const save = async (segments: string[], value: { version: number }) => {
    const key = segments.join('/');
    // The local version is recorded before the write is in flight, so an echo
    // of an older write arriving later can never regress the UI.
    guard(key, value.version);
    // Whole-document set, not merge: the document is the unit of conflict,
    // and a full replace means a removed field stays removed.
    setDoc(ref(segments), value).catch(failed(key));
  };

  const remove = async (segments: string[]) => {
    const key = segments.join('/');
    delivered.delete(key);
    deleteDoc(ref(segments)).catch(failed(key));
  };

  return {
    getTasks: () => readCollection(tasksCollection(syncKey), parseTask),
    subscribeTasks: (cb) => subscribeCollection(tasksCollection(syncKey), parseTask, cb),
    saveTask: (task) => save(taskDoc(syncKey, task.id), task),
    deleteTask: (id) => remove(taskDoc(syncKey, id)),

    getProjects: () => readCollection(projectsCollection(syncKey), parseProject),
    subscribeProjects: (cb) => subscribeCollection(projectsCollection(syncKey), parseProject, cb),
    saveProject: (project) => save(projectDoc(syncKey, project.id), project),
    deleteProject: (id) => remove(projectDoc(syncKey, id)),

    getLabels: () => readCollection(labelsCollection(syncKey), parseLabel),
    subscribeLabels: (cb) => subscribeCollection(labelsCollection(syncKey), parseLabel, cb),
    saveLabel: (label) => save(labelDoc(syncKey, label.id), label),
    deleteLabel: (id) => remove(labelDoc(syncKey, id)),

    async getSettings() {
      const snap = await getDocFromServer(ref(settingsDoc(syncKey)));
      return snap.exists() ? parseSettings(snap.data(), 'getSettings') : null;
    },
    subscribeSettings: (cb) => subscribeDoc(settingsDoc(syncKey), parseSettings, cb),
    saveSettings: (settings) => save(settingsDoc(syncKey), settings),

    /**
     * Read from the task collection's own metadata: pending writes mean
     * something hasn't been confirmed yet; a cache-only snapshot with nothing
     * pending means no connection. The browser's online flag catches the
     * moment the network drops before Firestore notices.
     */
    subscribeStatus(cb) {
      let pending = false;
      let fromCache = true;
      const emit = () => {
        const status: SyncStatus = pending
          ? navigator.onLine ? 'sending' : 'offline'
          : fromCache || !navigator.onLine ? 'offline' : 'synced';
        cb(status);
      };
      const unsubscribe = onSnapshot(
        collection(db, ...(tasksCollection(syncKey) as [string, ...string[]])),
        { includeMetadataChanges: true },
        (snap) => {
          pending = snap.metadata.hasPendingWrites;
          fromCache = snap.metadata.fromCache;
          emit();
        },
        () => cb('offline'),
      );
      window.addEventListener('online', emit);
      window.addEventListener('offline', emit);
      return () => {
        unsubscribe();
        window.removeEventListener('online', emit);
        window.removeEventListener('offline', emit);
      };
    },

    settle: () => waitForPendingWrites(db),

    subscribeWriteErrors(cb) {
      errorListeners.add(cb);
      return () => void errorListeners.delete(cb);
    },
  };
}
