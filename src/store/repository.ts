import type { DayRecord, Path } from '../types/path';
import type { Settings } from '../types/settings';

export type Unsubscribe = () => void;

/**
 * Everything the app knows how to store, expressed the way Firestore expresses
 * it: one-shot reads, live subscriptions, and whole-document writes.
 *
 * The subscription methods are the point of this interface. Firestore delivers
 * data through `onSnapshot` — a listener that fires now and again whenever the
 * document changes anywhere, on any device. Code written against a synchronous
 * `localStorage.getItem` has to be torn up to accept that; code written against
 * a subscription does not. So the app subscribes from the start, even though
 * today the data is coming from the same tab it was written in.
 *
 * Callbacks are always invoked asynchronously, including the first one, because
 * that is what Firestore does. Handling the loading state is therefore forced
 * now rather than discovered later.
 */
export interface AnchorRepository {
  getPath(date: string): Promise<Path | null>;
  subscribePath(date: string, cb: (path: Path | null) => void): Unsubscribe;
  savePath(path: Path): Promise<void>;
  deletePath(date: string): Promise<void>;
  /** Inclusive date range, ordered oldest first. */
  listPaths(from: string, to: string): Promise<Path[]>;

  /** Inclusive date range, ordered oldest first. */
  getDays(from: string, to: string): Promise<DayRecord[]>;
  subscribeDays(from: string, to: string, cb: (days: DayRecord[]) => void): Unsubscribe;
  saveDay(day: DayRecord): Promise<void>;

  getSettings(): Promise<Settings | null>;
  subscribeSettings(cb: (settings: Settings | null) => void): Unsubscribe;
  saveSettings(settings: Settings): Promise<void>;
}
