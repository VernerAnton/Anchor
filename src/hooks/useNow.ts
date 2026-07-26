import { useEffect, useState } from 'react';
import { minutesNow } from '../lib/time';

/**
 * Ticking wall clock.
 *
 * Accepts a `?now=HH:MM` override so a given moment on the path can be
 * loaded directly — the states worth reviewing (a point going passed, an
 * offer opening) are otherwise only reachable by waiting for them.
 */
export function useNow(): { now: number; date: Date; pinned: boolean } {
  const pinnedMinutes = readPinned();
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    if (pinnedMinutes !== null) return;
    const id = setInterval(() => setDate(new Date()), 20_000);
    return () => clearInterval(id);
  }, [pinnedMinutes]);

  return {
    now: pinnedMinutes ?? minutesNow(date),
    date,
    pinned: pinnedMinutes !== null,
  };
}

function readPinned(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('now');
  const m = raw?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
