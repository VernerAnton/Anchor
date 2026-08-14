import { SCHEMA_VERSION } from '../store/keys';

/**
 * App-level settings. Nearly empty today; it exists from day one because the
 * settings document doubles as the "this install has been initialised" marker,
 * and because adding a field to an existing synced document is easy while
 * adding a whole document type mid-flight is not.
 */
/**
 * Which theme is painted. Both are complete and neither is a variant of the
 * other: noir is the console at night, blossom is daylight on paper.
 */
export type ThemeId = 'noir' | 'blossom';

export interface Settings {
  /**
   * Which side of the app you're on. Remembered rather than chosen each time:
   * turning the path on is a decision about how you're working, not a
   * navigation step, and it should still be on tomorrow — and on your phone,
   * since this document syncs.
   */
  pathMode: boolean;
  /**
   * Remembered and synced, like path mode: which theme you want is a decision
   * about how you work, not something to make again on every device.
   */
  theme: ThemeId;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

export function defaultSettings(): Settings {
  return {
    pathMode: false,
    theme: 'noir',
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}
