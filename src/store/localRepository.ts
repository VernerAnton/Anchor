import type { Project, Task } from '../types/task';
import type { AnchorRepository, Unsubscribe } from './repository';
import {
  localKey,
  projectDoc,
  projectsCollection,
  settingsDoc,
  taskDoc,
  tasksCollection,
} from './keys';
import { parseProject, parseSettings, parseTask } from './schemas';

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
    // A corrupt or unreadable entry reads as absent rather than throwing.
    // Losing a document is bad; refusing to start the app is worse.
    return null;
  }
}

/**
 * Stands in for a Firestore whole-collection read. Library documents are
 * id-keyed, so everything under the prefix comes back and the caller orders it.
 *
 * Everything is validated on the way out, exactly as the Firestore backend
 * validates its snapshots. Stored data goes stale the moment the model moves
 * on, and the schemas are where a stale shape gets upgraded — a backend that
 * skips them hands components fields they were written before, which is a
 * crash during render rather than a bad pixel.
 */
function scanAll<T>(prefix: string, parse: (data: unknown, context: string) => T | null): T[] {
  const found: T[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null || !key.startsWith(prefix)) continue;
    const raw = readJson<unknown>(key);
    if (raw === null) continue;
    const doc = parse(raw, key);
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

  const tasksPrefix = `${localKey(tasksCollection(userId))}:`;
  const projectsPrefix = `${localKey(projectsCollection(userId))}:`;

  return {
    async getTasks() {
      return scanAll<Task>(tasksPrefix, parseTask);
    },

    subscribeTasks(cb) {
      return watch(
        (changed) => changed.startsWith(tasksPrefix),
        () => cb(scanAll<Task>(tasksPrefix, parseTask)),
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

    async getProjects() {
      return scanAll<Project>(projectsPrefix, parseProject);
    },

    subscribeProjects(cb) {
      return watch(
        (changed) => changed.startsWith(projectsPrefix),
        () => cb(scanAll<Project>(projectsPrefix, parseProject)),
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
      const raw = readJson<unknown>(localKey(settingsDoc(userId)));
      return raw === null ? null : parseSettings(raw, 'settings');
    },

    subscribeSettings(cb) {
      const key = localKey(settingsDoc(userId));
      return watch(
        (changed) => changed === key,
        () => {
          const raw = readJson<unknown>(key);
          cb(raw === null ? null : parseSettings(raw, 'settings'));
        },
      );
    },

    async saveSettings(settings) {
      writeVersioned(localKey(settingsDoc(userId)), settings);
    },
  };
}
