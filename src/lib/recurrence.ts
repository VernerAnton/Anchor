import type { Recurrence, RecurrenceSpec } from '../types/task';
import {
  addDays,
  addMonths,
  dateOf,
  dayOf,
  daysBetween,
  daysInMonth,
  monthsBetween,
  nthWeekdayOfMonth,
  weekStart,
  weekdayOf,
  yearMonthOf,
  MONTH_NAMES,
} from './dates';

/**
 * The recurrence engine: pure functions over YYYY-MM-DD strings.
 *
 * Rules are explicit — a frequency, an interval, and selectors. No
 * natural-language parsing anywhere; ambiguity is removed at the point of
 * entry rather than guessed at afterwards.
 *
 * The engine is built from one predicate and one scan. `matches` answers "does
 * this rule fall on this date", and `nextOccurrence` walks forward until it
 * says yes. That is deliberately not closed-form arithmetic per variant: a
 * scan makes every variant correct by the same argument and exhaustively
 * testable, and the bound below keeps it to microseconds.
 */

/** Positive modulo, so dates before the anchor phase the same as dates after. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** `-1` tracks the month's last day; anything else clamps to the month length. */
function resolveDay(day: number, year: number, month: number): number {
  const length = daysInMonth(year, month);
  return day === -1 ? length : Math.min(Math.max(1, day), length);
}

/** Does the date satisfy the rule's selectors, ignoring interval phase? */
function matchesSelectors(spec: RecurrenceSpec, date: string): boolean {
  const { year, month } = yearMonthOf(date);

  switch (spec.freq) {
    case 'daily':
      return true;

    case 'weekly':
      return spec.weekdays.includes(weekdayOf(date));

    case 'monthlyByDate':
      return dayOf(date) === resolveDay(spec.day, year, month);

    case 'monthlyByWeekday':
      return date === nthWeekdayOfMonth(year, month, spec.week, spec.weekday);

    case 'yearlyByDate':
      return spec.months.includes(month) && dayOf(date) === resolveDay(spec.day, year, month);

    case 'yearlyByWeekday':
      return (
        spec.months.includes(month) &&
        date === nthWeekdayOfMonth(year, month, spec.week, spec.weekday)
      );
  }
}

/**
 * Is this date in an "on" period? Only interval > 1 can say no, and only when
 * an anchor fixes the phase — without one there is no way to know which
 * Saturday "every other Saturday" means.
 *
 * Callers that need the interval to bite should resolve the anchor first (see
 * `withAnchor`). This matters most for `daily`, which has no selectors at all:
 * an unanchored daily rule has nothing else to constrain it, so treating a
 * missing anchor as "no constraint" would quietly turn every N days into
 * every day.
 */
function matchesPhase(rule: Recurrence, date: string): boolean {
  if (rule.interval <= 1 || rule.anchor === null) return true;

  switch (rule.freq) {
    case 'daily':
      return mod(daysBetween(rule.anchor, date), rule.interval) === 0;

    case 'weekly':
      return (
        mod(daysBetween(weekStart(rule.anchor), weekStart(date)) / 7, rule.interval) === 0
      );

    case 'monthlyByDate':
    case 'monthlyByWeekday':
      return mod(monthsBetween(rule.anchor, date), rule.interval) === 0;

    case 'yearlyByDate':
    case 'yearlyByWeekday':
      return mod(yearMonthOf(date).year - yearMonthOf(rule.anchor).year, rule.interval) === 0;
  }
}

/** Does this rule fall on this date? */
export function matches(rule: Recurrence, date: string): boolean {
  return matchesSelectors(rule, date) && matchesPhase(rule, date);
}

/**
 * Gives an unanchored rule a phase to count from. "Every 14 days" with nothing
 * fixing it means fourteen days from wherever we are now — the reading anyone
 * would expect, and the only one under which the interval means anything.
 */
function withAnchor(rule: Recurrence, fallback: string): Recurrence {
  return rule.anchor === null ? { ...rule, anchor: fallback } : rule;
}

/**
 * How far forward to look before concluding a rule can't produce a date.
 * Sized per frequency so even a ten-year interval terminates, while a daily
 * rule stops almost immediately.
 */
function scanLimitDays(rule: Recurrence): number {
  const interval = Math.max(1, rule.interval);
  switch (rule.freq) {
    case 'daily':
      return interval + 2;
    case 'weekly':
      return (interval + 1) * 7 + 7;
    case 'monthlyByDate':
    case 'monthlyByWeekday':
      return (interval + 1) * 31 + 62;
    case 'yearlyByDate':
    case 'yearlyByWeekday':
      return (interval + 1) * 366 + 366;
  }
}

/** Advance one whole interval, in whatever unit the frequency counts in. */
function advanceOneInterval(rule: Recurrence, from: string): string {
  const interval = Math.max(1, rule.interval);
  switch (rule.freq) {
    case 'daily':
      return addDays(from, interval);
    case 'weekly':
      return addDays(from, interval * 7);
    case 'monthlyByDate':
    case 'monthlyByWeekday':
      return addMonths(from, interval);
    case 'yearlyByDate':
    case 'yearlyByWeekday':
      return addMonths(from, interval * 12);
  }
}

/**
 * The next date this rule falls on, strictly after `after`.
 *
 * `null` means the rule can't produce one — a shape the editor tries hard not
 * to allow, but an honest answer is better than an invented date.
 */
export function nextOccurrence(rule: Recurrence, after: string): string | null {
  const limit = scanLimitDays(rule);

  if (rule.mode === 'fromCompletion') {
    // Measured from when it was actually finished: step a whole interval, then
    // settle on the first date the selectors accept. Phase is deliberately
    // ignored — the anchor describes a calendar the user has opted out of.
    const base = advanceOneInterval(rule, after);
    for (let i = 0; i < limit; i++) {
      const candidate = addDays(base, i);
      if (matchesSelectors(rule, candidate)) return candidate;
    }
    return null;
  }

  const anchored = withAnchor(rule, after);
  for (let i = 1; i <= limit; i++) {
    const candidate = addDays(after, i);
    if (matches(anchored, candidate)) return candidate;
  }
  return null;
}

/**
 * Where the next occurrence is measured from when a task is completed on
 * `today`: the due date if it's still ahead (done early keeps the rhythm),
 * otherwise today (done late doesn't backfill). Nothing stores "missed", and
 * that includes recurrence — an overdue rule never generates a queue of
 * occurrences that quietly went by.
 */
export function recurrenceBase(dueDate: string | null, today: string): string {
  return dueDate !== null && dueDate > today ? dueDate : today;
}

// ── Describing a rule ──────────────────────────────────────────────────────

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Monday-first for display; stored in JS order, where Sunday is 0. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const POSITION_NAMES: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  [-1]: 'last',
};

function everyPhrase(interval: number, unit: string): string {
  return interval <= 1 ? `every ${unit}` : `every ${interval} ${unit}s`;
}

function dayPhrase(day: number): string {
  return day === -1 ? 'last day' : `day ${day}`;
}

function monthsPhrase(months: number[]): string {
  return months
    .filter((m) => m >= 1 && m <= 12)
    .sort((a, b) => a - b)
    .map((m) => MONTH_NAMES[m - 1])
    .join(' ');
}

/** Human-readable summary of a rule, for chips and the editor's own check. */
export function describeRecurrence(rule: Recurrence): string {
  const parts: string[] = [];

  switch (rule.freq) {
    case 'daily':
      parts.push(everyPhrase(rule.interval, 'day'));
      break;

    case 'weekly': {
      const ordered = DISPLAY_ORDER.filter((d) => rule.weekdays.includes(d));
      parts.push(everyPhrase(rule.interval, 'week'));
      if (ordered.length > 0 && ordered.length < 7) {
        parts.push(ordered.map((d) => WEEKDAY_NAMES[d]).join(' '));
      } else if (ordered.length === 7) {
        parts.push('every day');
      }
      break;
    }

    case 'monthlyByDate':
      parts.push(everyPhrase(rule.interval, 'month'), dayPhrase(rule.day));
      break;

    case 'monthlyByWeekday':
      parts.push(
        everyPhrase(rule.interval, 'month'),
        `${POSITION_NAMES[rule.week] ?? 'first'} ${WEEKDAY_NAMES[rule.weekday] ?? ''}`.trim(),
      );
      break;

    case 'yearlyByDate':
      parts.push(everyPhrase(rule.interval, 'year'), monthsPhrase(rule.months), dayPhrase(rule.day));
      break;

    case 'yearlyByWeekday':
      parts.push(
        everyPhrase(rule.interval, 'year'),
        monthsPhrase(rule.months),
        `${POSITION_NAMES[rule.week] ?? 'first'} ${WEEKDAY_NAMES[rule.weekday] ?? ''}`.trim(),
      );
      break;
  }

  if (rule.mode === 'fromCompletion') parts.push('from completion');

  return parts.filter(Boolean).join(' · ');
}

// ── Building a rule ────────────────────────────────────────────────────────

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Which editor group a rule belongs to — monthly and yearly each have two forms. */
export function frequencyOf(rule: Recurrence): Frequency {
  switch (rule.freq) {
    case 'daily':
      return 'daily';
    case 'weekly':
      return 'weekly';
    case 'monthlyByDate':
    case 'monthlyByWeekday':
      return 'monthly';
    case 'yearlyByDate':
    case 'yearlyByWeekday':
      return 'yearly';
  }
}

/**
 * A sensible starting rule for a frequency, seeded from a date so switching
 * frequency in the editor lands on something already meaningful rather than an
 * arbitrary default the user has to correct.
 */
export function defaultRule(frequency: Frequency, from: string): Recurrence {
  const base = { interval: 1, anchor: from, mode: 'grid' as const };
  const { month } = yearMonthOf(from);

  switch (frequency) {
    case 'daily':
      return { freq: 'daily', ...base, mode: 'fromCompletion' };
    case 'weekly':
      return { freq: 'weekly', weekdays: [weekdayOf(from)], ...base };
    case 'monthly':
      return { freq: 'monthlyByDate', day: dayOf(from), ...base };
    case 'yearly':
      return { freq: 'yearlyByDate', months: [month], day: dayOf(from), ...base };
  }
}

export { dayOf, dateOf };
