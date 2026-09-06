/**
 * Calendar-date arithmetic on YYYY-MM-DD strings.
 *
 * Dates in Anchor are calendar days, not instants — "due Tuesday" means
 * Tuesday wherever you wake up. Internally every operation converts to UTC
 * midnight and back, so DST transitions can never shift a date by a day.
 * The string format also compares correctly with plain `<`/`>`.
 */

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** JavaScript's weekday order, abbreviated. Sunday is 0 here as everywhere. */
export const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * "Mon 8 Sep" — the compact form, for anywhere a date has to fit beside
 * something else. No year: every caller is looking at dates within a year of
 * now, and the ones that aren't say so themselves.
 */
export function shortDate(date: string): string {
  const { month } = yearMonthOf(date);
  return `${WEEKDAY_ABBR[weekdayOf(date)]} ${dayOf(date)} ${MONTH_NAMES[month - 1]}`;
}

export function todayStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function pad(n: number): string {
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

const MS_PER_DAY = 86_400_000;

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / MS_PER_DAY);
}

/** Whole calendar months between two dates, ignoring day-of-month. */
export function monthsBetween(from: string, to: string): number {
  const a = yearMonthOf(from);
  const b = yearMonthOf(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/**
 * Adds months, clamping the day to the target month's length so 31 January
 * plus one month is 28 February rather than spilling into March.
 */
export function addMonths(date: string, months: number): string {
  const { year, month } = yearMonthOf(date);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return dateOf(targetYear, targetMonth, Math.min(dayOf(date), daysInMonth(targetYear, targetMonth)));
}

/**
 * How many dates in [from, to] fall on a weekday in `set`. Closed-form —
 * whole weeks contribute the set's size each, then the remainder tail is
 * checked day by day (at most six of them) — so callers can ask about spans
 * of years without paying for a scan.
 */
export function countMatchingWeekdays(from: string, to: string, set: ReadonlySet<number>): number {
  if (to < from) return 0;
  const span = daysBetween(from, to) + 1;
  const weeks = Math.floor(span / 7);
  let count = weeks * set.size;
  for (let i = weeks * 7; i < span; i++) {
    if (set.has((weekdayOf(from) + i) % 7)) count++;
  }
  return count;
}

/**
 * The Monday beginning this date's week. Used to compare weeks when a rule
 * repeats every N weeks — Monday-based to match the Monday-first weekday
 * picker, so "every other week" means what the UI shows.
 */
export function weekStart(date: string): string {
  // Sunday is 0 in JS but the end of a Monday-based week, so it steps back 6.
  const offset = (weekdayOf(date) + 6) % 7;
  return addDays(date, -offset);
}

/** The seven dates of the week a date falls in, Monday first. */
export function weekDates(date: string): string[] {
  const start = weekStart(date);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(start, offset));
}

/**
 * The date of the `week`-th `weekday` in a month — week 1..4 counting from the
 * start, or -1 for the last one. Returns null when the month has no such date
 * (there is no fifth Friday in most months), which the caller reads as "this
 * month doesn't qualify" rather than as an error.
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  week: number,
  weekday: number,
): string | null {
  if (week === -1) {
    const last = dateOf(year, month, daysInMonth(year, month));
    return addDays(last, -((weekdayOf(last) - weekday + 7) % 7));
  }
  if (week < 1 || week > 4) return null;
  const first = dateOf(year, month, 1);
  const firstMatch = 1 + ((weekday - weekdayOf(first) + 7) % 7);
  const day = firstMatch + (week - 1) * 7;
  return day > daysInMonth(year, month) ? null : dateOf(year, month, day);
}
