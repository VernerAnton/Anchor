import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Notices when a newer build has taken over, and lets the user choose when to
 * pick it up.
 *
 * The service worker installs a new build happily enough, but a page that is
 * already open keeps running the JavaScript it started with, and the browser
 * only looks for a new worker on a cold load. An installed app resumed from the
 * background can therefore sit on an old build for days without a hint — which
 * is how a bug fixed a week ago can still be on your phone. So updates are
 * checked on a timer *and* whenever the tab becomes visible. The visibility
 * check is the one that matters: this app is switched back to far more often
 * than it is loaded fresh.
 *
 * `onNeedReload` is the correct hook here, and the choice is load-bearing.
 * Registration stays on `autoUpdate`, which is what lets a new worker claim the
 * already-installed copies on the owner's devices rather than waiting politely
 * behind a prompt nobody sees. Under that mode the plugin never calls
 * `onNeedRefresh`, and its `updateServiceWorker` does nothing — but it *will*
 * call `window.location.reload()` on its own unless `onNeedReload` is supplied.
 * Supplying it is what turns an unannounced reload into an offer.
 *
 * That matters because a reload nobody asked for discards whatever was
 * half-typed into a task. By the time this fires the new worker is already
 * controlling the page, so a plain reload is all it takes to land on the new
 * build.
 */

/** Hourly is frequent enough for an app deployed a few times a week. */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export interface AppUpdate {
  /** A newer build is active and waiting for a reload. */
  needRefresh: boolean;
  /** Pick it up now. */
  updateApp: () => void;
  /** Keep this build for now; the offer returns on the next check. */
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdate {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let onVisible: (() => void) | undefined;

    registerSW({
      immediate: true,
      onNeedReload() {
        if (!cancelled) setNeedRefresh(true);
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => void registration.update();
        timer = window.setInterval(check, UPDATE_INTERVAL_MS);
        onVisible = () => {
          if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', onVisible);
      },
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return {
    needRefresh,
    updateApp: () => window.location.reload(),
    dismiss: () => setNeedRefresh(false),
  };
}
