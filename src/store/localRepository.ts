import type { DayRecord, Path } from '../types/path';
import type { Project, Task } from '../types/task';
import type { Settings } from '../types/settings';
import type { AnchorRepository, Unsubscribe } from './repository';
import {
  dayDoc,
  daysCollection,
  localKey,
  pathDoc,
  pathsCollection,
  projectDoc,
  projectsCollection,
  settingsDoc,
  taskDoc,
  tasksCollection,
} from './keys';

/**
 * localStorage behind the Firestore-shaped interface.
 *
 * Two details make this a real rehearsal rather than a stub. Callbacks fire
 * asynchronously, so the app has to handle a loading state exactly as it will
 * with a network backend. And the `storage` event means a write in one tab
 * pushes into every other open tab — which is genuinely live sync between two
 * clients, just over a very short wire. If the app works across two tabs, the
 * subscription plumbing is right.
 */

interface Watcher {
  matches(key: string): boolean;
  run(): void;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    // A corrupt or unreadable entry reads as absent rather than throwing. Losing
    // a day is bad; refusing to start the app is worse.
    return null;
  }
}

/**
 * Stands in for a Firestore range query over a collection. Both `paths` and
 * `days` are keyed by date, so the document id is the thing being filtered.
 */
function scan<T extends { date: string }>(prefix: string, from: string, to: string): T[] {
  const found: T[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null || !key.startsWith(prefix)) continue;
    const doc = readJson<T>(key);
    if (doc && doc.date >= from && doc.date <= to) found.push(doc);
  }
  return found.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The same, for id-keyed collections. Library documents have no date to filter
 * on, so everything under the prefix comes back and the caller orders it.
 */
function scanAll<T>(prefix: string): T[] {
  const found: T[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null || !key.startsWith(prefix)) continue;
    const doc = readJson<T>(key);
    if (doc) found.push(doc);
  }
  return found;
}

export function createLocalRepository(userId: string): AnchorRepository {
  const watchers = new Set<Watcher>();

  const notify = (key: string) => {
    for (const watcher of watchers) {
      if (watcher.matches(key)) watcher.run();
    }
  };

  // Writes from other tabs arrive here. This is the whole of cross-client sync.
  window.addEventListener('storage', (event) => {
    if (event.key) notify(event.key);
  });

  const write = (key: string, value: unknown) => {
    localStorage.setItem(key, JSON.stringify(value));
    notify(key);
  };

  /**
   * The stale-echo guard, mirrored from the Firestore side so the two backends
   * behave identically: a document carrying a lower version than what's stored
   * is an out-of-order write and is refused. Missing versions (docs written by
   * an older build) count as 0 and never block.
   */
  const writeVersioned = (key: string, value: { version?: number }) => {
    const existing = readJson<{ version?: number }>(key);
    if (existing && (existing.version ?? 0) > (value.version ?? 0)) return;
    write(key, value);
  };

  const watch = (matches: (key: string) => boolean, run: () => void): Unsubscribe => {
    const watcher: Watcher = { matches, run };
    watchers.add(watcher);
    // Deliberately async, matching Firestore — the first callback never lands
    // during the render that subscribed.
    queueMicrotask(run);
    return () => void watchers.delete(watcher);
  };

  const watchKey = <T>(key: string, cb: (value: T | null) => void): Unsubscribe =>
    watch(
      (changed) => changed === key,
      () => cb(readJson<T>(key)),
    );

  return {
    async getPath(date) {
      return readJson<Path>(localKey(pathDoc(userId, date)));
    },

    subscribePath(date, cb) {
      return watchKey<Path>(localKey(pathDoc(userId, date)), cb);
    },

    async savePath(path) {
      writeVersioned(localKey(pathDoc(userId, path.date)), path);
    },

    async deletePath(date) {
      const key = localKey(pathDoc(userId, date));
      localStorage.removeItem(key);
      notify(key);
    },

    async listPaths(from, to) {
      return scan<Path>(`${localKey(pathsCollection(userId))}:`, from, to);
    },

    async getDays(from, to) {
      return scan<DayRecord>(`${localKey(daysCollection(userId))}:`, from, to);
    },

    subscribeDays(from, to, cb) {
      const prefix = `${localKey(daysCollection(userId))}:`;
      return watch(
        (changed) => changed.startsWith(prefix),
        () => cb(scan<DayRecord>(prefix, from, to)),
      );
    },

    async saveDay(day) {
      writeVersioned(localKey(dayDoc(userId, day.date)), day);
    },

    subscribeTasks(cb) {
      const prefix = `${localKey(tasksCollection(userId))}:`;
      return watch(
        (changed) => changed.startsWith(prefix),
        () => cb(scanAll<Task>(prefix)),
      );
    },

    async saveTask(task) {
      writeVersioned(localKey(taskDoc(userId, task.id)), task);
    },

    async deleteTask(id) {
      const key = localKey(taskDoc(userId, id));
      localStorage.removeItem(key);
      notify(key);
    },

    subscribeProjects(cb) {
      const prefix = `${localKey(projectsCollection(userId))}:`;
      return watch(
        (changed) => changed.startsWith(prefix),
        () => cb(scanAll<Project>(prefix)),
      );
    },

    async saveProject(project) {
      writeVersioned(localKey(projectDoc(userId, project.id)), project);
    },

    async deleteProject(id) {
      const key = localKey(projectDoc(userId, id));
      localStorage.removeItem(key);
      notify(key);
    },

    async getSettings() {
      return readJson<Settings>(localKey(settingsDoc(userId)));
    },

    subscribeSettings(cb) {
      return watchKey<Settings>(localKey(settingsDoc(userId)), cb);
    },

    async saveSettings(settings) {
      writeVersioned(localKey(settingsDoc(userId)), settings);
    },
  };
}
