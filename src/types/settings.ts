import { SCHEMA_VERSION } from '../store/keys';
import type { ThemePreference } from '../lib/theme';

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
  /**
   * Remembered and synced, like path mode. `system` follows the device, which
   * is the default and the reason a phone that dims itself at sunset dims the
   * app too; the other two are a deliberate override that stops following.
   */
  theme: ThemePreference;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

export function defaultSettings(): Settings {
  return {
    pathMode: false,
    theme: 'system',
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}
