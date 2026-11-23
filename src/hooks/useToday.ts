import { useEffect, useState } from 'react';
import { todayStr } from '../lib/dates';

/**
 * Today's date, kept current. An app left open overnight must move "today"
 * forward at midnight — otherwise yesterday's list sits there pretending to be
 * today's. Checked every minute, and at once when the app comes back to the
 * foreground (a phone that slept through midnight doesn't run timers).
 */
export function useToday(): string {
  const [today, setToday] = useState(todayStr);

  useEffect(() => {
    const check = () => setToday(todayStr());
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return today;
}
