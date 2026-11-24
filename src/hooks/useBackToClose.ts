import { useEffect, useRef } from 'react';

/**
 * Lets the system Back gesture close an overlay — the task panel or the menu
 * drawer on a phone — instead of leaving the view underneath it. That's what
 * Back means to anyone on Android, and in an installed app there's no browser
 * chrome to fall back on.
 *
 * Opening pushes one history entry with the same URL (so no route changes).
 * Back pops it and closes the overlay. Closing any other way (the Close
 * button, Escape) takes that entry back off, but only if it's still the
 * current one — if the person has since moved to another view, the entry is
 * left where it is rather than yanking them back a view.
 *
 * That check waits a tick. Tapping a link in the drawer closes the drawer
 * *before* the browser follows the link, so checking at once saw our entry
 * still on top, went back, and the back landed after the navigation —
 * bouncing the person to the view they had just left. A tick later the link
 * has been followed and our entry is no longer the current one.
 */
export function useBackToClose(open: boolean, onClose: () => void, tag: string): void {
  const pushed = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ anchorOverlay: tag }, '');
    pushed.current = true;

    const onPop = () => {
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      if (!pushed.current) return;
      pushed.current = false;
      // Closed some other way: take our entry back off, if it's still on top.
      window.setTimeout(() => {
        const state = window.history.state as { anchorOverlay?: string } | null;
        if (state?.anchorOverlay === tag) window.history.back();
      }, 0);
    };
  }, [open, tag]);
}
