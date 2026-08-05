import type { Recurrence } from '../types/task';
import { addDays, dateOf, dayOf, daysInMonth, weekdayOf, yearMonthOf } from './dates';

/**
 * The recurrence engine: pure functions over YYYY-MM-DD strings.
 *
 * Rules are explicit — every N days, chosen weekdays, monthly by date. No
 * natural-language parsing anywhere; ambiguity removed at the point of entry.
 *
 * Completing a recurring task calls `nextOccurrence` and writes the result to
 * `dueDate`. The base date is the *later* of today and the due date, so an
 * overdue recurring task never generates a backlog of missed occurrences —
 * nothing stores "missed", and that includes recurrence.
 */

/** The first occurrence strictly after `after`. */
export function nextOccurrence(rule: Recurrence, after: string): string {
  switch (rule.kind) {
    case 'everyNDays':
      return addDays(after, Math.max(1, rule.n));

    case 'weekly': {
      const wanted = new Set(rule.weekdays.filter((d) => d >= 0 && d <= 6));
      // A weekly rule with no valid days behaves as "a week from now" rather
      // than looping forever or throwing away the task.
      if (wanted.size === 0) return addDays(after, 7);
      let candidate = after;
      for (let i = 0; i < 7; i++) {
        candidate = addDays(candidate, 1);
        if (wanted.has(weekdayOf(candidate))) return candidate;
      }
      return candidate;
    }

    case 'monthlyByDate': {
      const target = Math.min(Math.max(1, rule.day), 31);
      const { year, month } = yearMonthOf(after);
      // This month, clamped to its length — but only if still strictly ahead.
      const thisMonth = dateOf(year, month, Math.min(target, daysInMonth(year, month)));
      if (thisMonth > after) return thisMonth;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      return dateOf(nextYear, nextMonth, Math.min(target, daysInMonth(nextYear, nextMonth)));
    }
  }
}

/**
 * Where the next occurrence is measured from when a task is completed on
 * `today`: the due date if it's still ahead (done early keeps the rhythm),
 * otherwise today (done late doesn't backfill).
 */
export function recurrenceBase(dueDate: string | null, today: string): string {
  return dueDate !== null && dueDate > today ? dueDate : today;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Human-readable summary of a rule, for chips and editors. */
export function describeRecurrence(rule: Recurrence): string {
  switch (rule.kind) {
    case 'everyNDays':
      return rule.n === 1 ? 'every day' : `every ${rule.n} days`;
    case 'weekly': {
      // Displayed Monday-first; stored in JS order (0 = Sunday).
      const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => rule.weekdays.includes(d));
      if (ordered.length === 0) return 'weekly';
      if (ordered.length === 7) return 'every day';
      return `weekly · ${ordered.map((d) => WEEKDAY_NAMES[d]).join(' ')}`;
    }
    case 'monthlyByDate':
      return `monthly · day ${rule.day}`;
  }
}

export { dayOf };
