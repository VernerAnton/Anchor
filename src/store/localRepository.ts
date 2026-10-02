import type { AnchorRepository, Unsubscribe } from './repository';
import { localKey, taskDoc, tasksCollection } from './keys';
import { parseTask } from './schemas';

/**
 * localStorage behind the Firestore-shaped interface. A complete mode of the
 * app, not a stand-in: with no sync key, this is where the data lives.
 *
 * Two details make it a real rehearsal for the network backend. Callbacks fire
 * asynchronously, so the app handles a loading state exactly as it will with
 * Firestore. And the `storage` event pushes a write in one tab into every
 * other open tab — genuine live sync between two clients over a very short
 * wire. If the app works across two tabs, the subscription plumbing is right.
 */

interface Watcher {
  matches(key: string): boolean;
  run(): void;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    // A corrupt entry reads as absent rather than throwing. Losing a document
    // is bad; refusing to start the app is worse.
    return null;
  }
}

/**
 * Stands in for a Firestore whole-collection read. Everything is validated on
 * the way out, exactly as a network snapshot would be.
 */
function scanAll<T>(prefix: string, parse: (data: unknown, context: string) => T | null): T[] {
  const found: T[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null || !key.startsWith(prefix)) continue;
    const raw = readJson(key);
    if (raw === null) continue;
    const doc = parse(raw, key);
    if (doc) found.push(doc);
  }
  return found;
}

function storedVersion(raw: unknown): number {
  if (raw && typeof raw === 'object' && 'version' in raw && typeof raw.version === 'number') {
    return raw.version;
  }
  return 0;
}

export function createLocalRepository(userId: string): AnchorRepository {
  const watchers = new Set<Watcher>();

  const notify = (key: string) => {
    for (const watcher of watchers) {
      if (watcher.matches(key)) watcher.run();
    }
  };

  // Writes from other tabs arrive here. This is the whole of cross-tab sync.
  window.addEventListener('storage', (event) => {
    if (event.key) notify(event.key);
  });

  /**
   * The stale-echo guard, matching what the Firestore backend will do: a
   * document carrying a lower version than what's stored is an out-of-order
   * write and is refused. Integer versions, never timestamps — a device with a
   * wrong clock can't lose data this way.
   */
  const writeVersioned = (key: string, value: { version: number }) => {
    if (storedVersion(readJson(key)) > value.version) return;
    localStorage.setItem(key, JSON.stringify(value));
    notify(key);
  };

  const watch = (matches: (key: string) => boolean, run: () => void): Unsubscribe => {
    const watcher: Watcher = { matches, run };
    watchers.add(watcher);
    // Deliberately async, matching Firestore — the first callback never lands
    // during the render that subscribed.
    queueMicrotask(() => {
      if (watchers.has(watcher)) run();
    });
    return () => void watchers.delete(watcher);
  };

  const tasksPrefix = `${localKey(tasksCollection(userId))}:`;

  return {
    async getTasks() {
      return scanAll(tasksPrefix, parseTask);
    },

    subscribeTasks(cb) {
      return watch(
        (changed) => changed.startsWith(tasksPrefix),
        () => cb(scanAll(tasksPrefix, parseTask)),
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
  };
}
