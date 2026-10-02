/**
 * Which colour scheme is painted.
 *
 * Phase 1 follows the device and nothing else; the synced light / dark /
 * system preference arrives in phase 4 and slots in where `systemScheme` is
 * read below.
 *
 * Every rule in `src/styles/tokens.css` is keyed off `data-theme` on <html>.
 * That's what makes the blank-theme test a URL: `?theme=none` sets a value no
 * token rule matches, every variable is left undefined, and the app renders
 * exactly as it would with the tokens file emptied.
 */

export type Scheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The paint hint read by the inline script in `index.html` before first
 * render. A cache of the last resolved answer, never the source of truth.
 */
const THEME_HINT_KEY = 'anchor-theme-hint';

/** `?theme=none` — the blank-theme test, run at the end of every phase. */
export function blankThemeRequested(search: string): boolean {
  return new URLSearchParams(search).get('theme') === 'none';
}

function systemScheme(): Scheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function paint(scheme: Scheme) {
  document.documentElement.dataset.theme = scheme;
  try {
    localStorage.setItem(THEME_HINT_KEY, scheme);
  } catch {
    // Storage can be blocked; the hint only saves one frame.
  }
}

/** Paints the scheme now and keeps following the device. Call once at boot. */
export function startTheme(): void {
  if (blankThemeRequested(window.location.search)) {
    document.documentElement.dataset.theme = 'none';
    return;
  }
  paint(systemScheme());
  window.matchMedia(DARK_QUERY).addEventListener('change', () => paint(systemScheme()));
}
