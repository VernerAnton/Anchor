import { useEffect, useState } from 'react';
import type { ThemeId, ThemePreference } from '../lib/theme';
import { DARK_QUERY, THEME_HINT_KEY, resolveTheme, systemPrefersDark } from '../lib/theme';

/**
 * Paints the chosen theme, and keeps following the device while it's asked to.
 *
 * The media query is watched rather than read once: a phone that switches
 * itself at sunset has to take the app with it, and an app that only notices
 * on reload is an app you have to reload at sunset.
 *
 * The attribute goes on the root element rather than anywhere inside the app,
 * because the page's own background sits behind everything the app draws — set
 * it lower and the browser paints white around the edges on overscroll, which
 * is the one place a dark theme gives itself away. `theme-color` follows it
 * too: that's what an installed app tints its status bar with, and without it
 * a phone frames a daylight app in the night one's colours.
 */
export function useTheme(preference: ThemePreference): ThemeId {
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    // The device may have changed while the tab was in the background.
    setPrefersDark(query.matches);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    const ground = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta && ground) meta.content = ground;

    // Left behind for the next cold start, so it opens on the right theme
    // rather than on the default and a flicker.
    try {
      localStorage.setItem(THEME_HINT_KEY, theme);
    } catch {
      // A blocked or full storage costs one frame of the wrong theme, which is
      // not worth failing a render over.
    }
  }, [theme]);

  return theme;
}
