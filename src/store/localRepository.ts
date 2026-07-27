import type { DayRecord, Path } from '../types/path';
import type { Settings } from '../types/settings';
import type { AnchorRepository, Unsubscribe } from './repository';
import { dayDoc, daysCollection, localKey, pathDoc, settingsDoc } from './keys';

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
      write(localKey(pathDoc(userId, path.date)), path);
    },

    subscribeDays(from, to, cb) {
      const prefix = `${localKey(daysCollection(userId))}:`;
      return watch(
        (changed) => changed.startsWith(prefix),
        () => {
          const days: DayRecord[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key === null || !key.startsWith(prefix)) continue;
            const day = readJson<DayRecord>(key);
            if (day && day.date >= from && day.date <= to) days.push(day);
          }
          days.sort((a, b) => a.date.localeCompare(b.date));
          cb(days);
        },
      );
    },

    async saveDay(day) {
      write(localKey(dayDoc(userId, day.date)), day);
    },

    async getSettings() {
      return readJson<Settings>(localKey(settingsDoc(userId)));
    },

    subscribeSettings(cb) {
      return watchKey<Settings>(localKey(settingsDoc(userId)), cb);
    },

    async saveSettings(settings) {
      write(localKey(settingsDoc(userId)), settings);
    },
  };
}
