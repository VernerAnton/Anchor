import type { ThemePreference } from '../types/settings';

/**
 * Which colour scheme is painted, and how the choice is made.
 *
 * Three settings, two schemes. `system` is the default and follows the device
 * — a phone that dims itself at sunset dims the app with it; `light` and
 * `dark` are a deliberate override. The preference lives in the synced
 * settings document; this module only resolves and paints it.
 *
 * Every rule in `src/styles/tokens.css` is keyed off `data-theme` on <html>.
 * That's what makes the blank-theme test a URL: `?theme=none` sets a value no
 * token rule matches, every variable is left undefined, and the app renders
 * exactly as it would with the tokens file emptied.
 */

export type Scheme = 'light' | 'dark';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The paint hint read by the inline script in `index.html` before first
 * render. A cache of the last resolved answer, never the source of truth.
 */
const THEME_HINT_KEY = 'anchor-theme-hint';

/** `?theme=none` — the blank-theme test, run at the end of every phase. */
export function blankThemeRequested(search: string): boolean {
  return new URLSearchParams(search).get('theme') === 'none';
}

export function resolveScheme(preference: ThemePreference, prefersDark: boolean): Scheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return prefersDark ? 'dark' : 'light';
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Paints a scheme on <html>, remembers it for the next cold start, and tints
 * an installed app's status bar to match — without that, a phone frames a
 * light app in dark chrome.
 */
export function paintScheme(scheme: Scheme): void {
  if (blankThemeRequested(window.location.search)) return;
  const root = document.documentElement;
  root.dataset.theme = scheme;
  const ground = getComputedStyle(root).getPropertyValue('--surface-page').trim();
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta && ground) meta.content = ground;
  try {
    localStorage.setItem(THEME_HINT_KEY, scheme);
  } catch {
    // Storage can be blocked; the hint only saves one frame.
  }
}

/**
 * Runs before the first render. Honours `?theme=none`; otherwise leaves the
 * scheme the pre-paint script chose from the hint — repainting from the
 * device here would flash the wrong scheme for anyone who chose one.
 */
export function startTheme(): void {
  if (blankThemeRequested(window.location.search)) document.documentElement.dataset.theme = 'none';
}
