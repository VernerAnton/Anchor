import { MONTH_NAMES, WEEKDAY_ABBR, addDays, dayOf, todayStr, weekdayOf } from './dates';

/**
 * Dates as words. Explicit, with no relative phrasing beyond Today and
 * Tomorrow — no "in 3 days", no "last week". A date that has gone by is
 * written exactly like any other: it's a date, not a verdict.
 */

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** The year, only when it isn't this one. */
function yearSuffix(date: string, today: string): string {
  return date.slice(0, 4) === today.slice(0, 4) ? '' : ` ${date.slice(0, 4)}`;
}

function month(date: string): string {
  return MONTH_NAMES[Number(date.slice(5, 7)) - 1] ?? '';
}

/** For a row, where the date shares a line: "Today", "Tomorrow", "Wed 23 Sep". */
export function rowDateLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return `${WEEKDAY_ABBR[weekdayOf(date)]} ${dayOf(date)} ${month(date)}${yearSuffix(date, today)}`;
}

/** For a section heading, which has room to spell it out: "Wednesday · 5 Aug". */
export function headingDateLabel(date: string, today: string): string {
  const weekday = WEEKDAY_NAMES[weekdayOf(date)];
  const dayMonth = `${dayOf(date)} ${month(date)}${yearSuffix(date, today)}`;
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return `Tomorrow · ${weekday} ${dayMonth}`;
  return `${weekday} · ${dayMonth}`;
}

/** The calendar day an instant fell on, in this device's time zone. */
export function dateOfInstant(instant: number): string {
  return todayStr(new Date(instant));
}
