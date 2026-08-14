/**
 * Which theme is painted, and how the choice is made.
 *
 * Three settings, two themes. `system` is the default and follows the device,
 * so a phone that dims itself at sunset dims the app with it; the other two
 * are a deliberate override that stops following.
 */
export type ThemePreference = 'system' | 'noir' | 'blossom';

/** What actually gets painted — a preference of `system` resolves to one of these. */
export type ThemeId = 'noir' | 'blossom';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The paint hint.
 *
 * The real preference lives in the synced settings document, which arrives a
 * moment after the page does — so the first paint would use the default and
 * then flip, which is exactly the flash worth avoiding. This key is a cache of
 * the last resolved answer, read by a tiny script in the document head before
 * anything renders. It is never the source of truth: the settings document
 * corrects it on arrival, and losing it costs one frame.
 */
export const THEME_HINT_KEY = 'anchor-theme-hint';

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/** The preference, plus what the device says, gives the theme to paint. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ThemeId {
  if (preference === 'noir' || preference === 'blossom') return preference;
  return prefersDark ? 'noir' : 'blossom';
}
