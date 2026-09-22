/**
 * Clock times: converting between 'HH:MM' and minutes from midnight.
 *
 * Times belong to a path entry — a task's placement on a particular day — not
 * to the task itself, so nothing here reads a task.
 *
 * Malformed input resolves to `null` rather than throwing — the same rule the
 * storage layer already follows. A time typed by hand, round-tripped through
 * an older build, or edited in a console is untrusted input, and "this task
 * has no time" is a state the day already knows how to render. Throwing here
 * would take down the whole view instead.
 */

const CLOCK = /^(\d{1,2}):(\d{2})$/;

export const MINUTES_IN_DAY = 1440;

/** Minutes from midnight, or `null` if this isn't a time. */
export function minutesOfClock(clock: string | null): number | null {
  if (clock === null) return null;
  const match = CLOCK.exec(clock.trim());
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes from midnight as 'HH:MM'. Past midnight wraps, so 1500 → '01:00'. */
export function clockOf(minutes: number): string {
  const wrapped = ((Math.round(minutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}
