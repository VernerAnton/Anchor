import { useEffect, useState } from 'react';
import { todayStr } from '../lib/dates';

function minutesNow(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * The wall clock, in minutes since midnight, for the day being looked at.
 *
 * `null` for any day that isn't today, and that null is doing real work: it is
 * what stops yesterday from being drawn as though you were standing in it.
 * A day you are not in has nothing running and nothing behind — only a record
 * of what happened.
 *
 * Ticks on the minute rather than the second. The path moves at the pace of a
 * day; a second hand on it would be a stopwatch, and nothing here is being
 * raced.
 */
export function useNow(date: string): number | null {
  const [now, setNow] = useState(minutesNow);

  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return date === todayStr() ? now : null;
}
