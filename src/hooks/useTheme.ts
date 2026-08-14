import { useEffect } from 'react';
import type { ThemeId } from '../types/settings';

/**
 * Paints the chosen theme onto the document.
 *
 * On the root element rather than anywhere inside the app, because the page's
 * own background sits behind everything the app draws — set it lower down and
 * the browser paints white around the edges on overscroll, which is the one
 * place a dark theme gives itself away.
 *
 * Also mirrored onto `theme-color`, which is what an installed app tints its
 * status bar and task-switcher card with. Without it a phone frames a daylight
 * app in the night one's colours.
 */
export function useTheme(theme: ThemeId): void {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg')
        .trim();
    }
  }, [theme]);
}
