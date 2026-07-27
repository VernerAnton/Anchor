/** Everything is minutes-from-midnight internally; formatting happens here. */

export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minutesNow(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Shifts a YYYY-MM-DD key by whole days, handling month and year edges. */
export function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function weekday(d: Date = new Date()): string {
  return WEEKDAYS[d.getDay()] ?? 'SUN';
}

/**
 * Rest trail length in pixels. Rest is drawn proportional to its real
 * duration so that a long rest looks long — a 40-minute rest that renders
 * the same height as a 15-minute one is just a gap again.
 *
 * Calibrated against the canonical mockup: 20min -> 46px, 40min -> 78px,
 * 15min -> 38px.
 */
export function restTrailLength(minutes: number): number {
  return 14 + 1.6 * minutes;
}
