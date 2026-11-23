/**
 * App-level settings: one synced document.
 *
 * It exists from early on because it doubles as the "this install has been
 * initialised" marker, and because adding a field to an existing synced
 * document is easy while adding a whole document type mid-flight is not.
 */

/** How rows are ordered within a section. */
export type SortBy = 'smart' | 'priority' | 'due' | 'name' | 'manual';

/**
 * A second cut through rows a view already chose. `none` means the view's own
 * sections — Today keeps Earlier and Today.
 */
export type GroupBy = 'none' | 'project' | 'label';

/** How one view groups and sorts. */
export interface ViewOptions {
  groupBy: GroupBy;
  sortBy: SortBy;
  /** Reads the chosen order from the bottom — absent values included, now first. */
  reverse: boolean;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  /** Chosen in phase 4; `system` follows the device. */
  theme: ThemePreference;
  /**
   * How each view arranges itself, keyed by view (`today`, `project:<id>`, …).
   * Per view, not one setting for all: Today and All tasks have different jobs,
   * and grouping the library by project while sorting today by priority is an
   * ordinary thing to want. A view with no entry uses the defaults, so nothing
   * is written for views never touched.
   */
  views: Record<string, ViewOptions>;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

export function defaultViewOptions(): ViewOptions {
  return { groupBy: 'none', sortBy: 'smart', reverse: false };
}
