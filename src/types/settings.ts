import { SCHEMA_VERSION } from '../store/keys';

/**
 * App-level settings. Nearly empty today; it exists from day one because the
 * settings document doubles as the "this install has been initialised" marker,
 * and because adding a field to an existing synced document is easy while
 * adding a whole document type mid-flight is not.
 */
export interface Settings {
  /**
   * Which side of the app you're on. Remembered rather than chosen each time:
   * turning the path on is a decision about how you're working, not a
   * navigation step, and it should still be on tomorrow — and on your phone,
   * since this document syncs.
   */
  pathMode: boolean;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

export function defaultSettings(): Settings {
  return {
    pathMode: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}
