import { SCHEMA_VERSION } from '../store/keys';
import type { ThemePreference } from '../lib/theme';
import type { GroupBy } from '../lib/grouping';
import type { SortBy } from '../lib/sorting';

/**
 * App-level settings. Nearly empty today; it exists from day one because the
 * settings document doubles as the "this install has been initialised" marker,
 * and because adding a field to an existing synced document is easy while
 * adding a whole document type mid-flight is not.
 */
/** How one view groups and sorts. */
export interface ViewOptions {
  groupBy: GroupBy;
  sortBy: SortBy;
  /** Reads the chosen order from the bottom. */
  reverse: boolean;
}

export function defaultViewOptions(): ViewOptions {
  return { groupBy: 'none', sortBy: 'smart', reverse: false };
}

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
  /**
   * How each view arranges itself, keyed the way views are named.
   *
   * Per view rather than one setting for all of them: Today and All tasks have
   * different jobs — one is "what am I doing now", the other is the library —
   * and grouping the library by project while sorting today by priority is an
   * ordinary thing to want, not an inconsistency to iron out.
   *
   * A view with no entry uses the defaults, so this stays empty until you
   * change something and nothing has to be written for views you never touch.
   */
  views: Record<string, ViewOptions>;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

export function defaultSettings(): Settings {
  return {
    pathMode: false,
    theme: 'system',
    views: {},
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}
