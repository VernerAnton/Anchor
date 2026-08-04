/**
 * Calendar-date arithmetic on YYYY-MM-DD strings.
 *
 * Dates in Anchor are calendar days, not instants — "due Tuesday" means
 * Tuesday wherever you wake up. Internally every operation converts to UTC
 * midnight and back, so DST transitions can never shift a date by a day.
 * The string format also compares correctly with plain `<`/`>`.
 */

export function todayStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function fromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** JavaScript convention: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return toUtc(date).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function yearMonthOf(date: string): { year: number; month: number } {
  const [y, m] = date.split('-').map(Number);
  return { year: y!, month: m! };
}

export function dateOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Day-of-month of a YYYY-MM-DD string. */
export function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}
