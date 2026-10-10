import { useEffect, useState } from 'react';
import type { ThemePreference } from '../types/settings';
import { DARK_QUERY, paintScheme, resolveScheme, systemPrefersDark } from '../lib/theme';

/**
 * Paints the chosen scheme, and keeps following the device while asked to.
 * The media query is watched, not read once: an app that only notices the
 * sunset on reload is an app you have to reload at sunset.
 */
export function useTheme(preference: ThemePreference): void {
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    setPrefersDark(query.matches);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const scheme = resolveScheme(preference, prefersDark);
  useEffect(() => paintScheme(scheme), [scheme]);
}
