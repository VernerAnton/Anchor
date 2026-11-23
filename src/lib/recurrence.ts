import type { Recurrence, RecurrenceSpec } from '../types/task';
import {
  addDays,
  addMonths,
  countMatchingWeekdays,
  dateOf,
  dayOf,
  daysBetween,
  daysInMonth,
  monthsBetween,
  nthWeekdayOfMonth,
  shortDate,
  weekStart,
  weekdayOf,
  yearMonthOf,
  MONTH_NAMES,
  WEEKDAY_ABBR,
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
      return spec.days.some((day) => dayOf(date) === resolveDay(day, year, month));

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
/** The first date on or after `from` whose weekday is in `set`. */
function firstMatchingWeekday(from: string, set: ReadonlySet<number>): string {
  let candidate = from;
  for (let i = 0; i < 7; i++) {
    if (set.has(weekdayOf(candidate))) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function matchesPhase(rule: Recurrence, date: string): boolean {
  if (rule.interval <= 1 || rule.anchor === null) return true;

  switch (rule.freq) {
    case 'daily':
      return mod(daysBetween(rule.anchor, date), rule.interval) === 0;

    case 'weekly': {
      if (rule.count === 'occurrences') {
        // The interval counts matching days themselves: index this date within
        // the sequence of matching days starting at the anchor (snapped to the
        // first matching day, which is occurrence zero).
        const set = new Set(rule.weekdays.filter((d) => d >= 0 && d <= 6));
        if (set.size === 0) return false;
        const start = firstMatchingWeekday(rule.anchor, set);
        if (date < start) {
          // Dates before the anchor phase backwards from it.
          return mod(countMatchingWeekdays(date, start, set) - 1, rule.interval) === 0;
        }
        return mod(countMatchingWeekdays(start, date, set) - 1, rule.interval) === 0;
      }
      return (
        mod(daysBetween(weekStart(rule.anchor), weekStart(date)) / 7, rule.interval) === 0
      );
    }

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
  const next = nextIgnoringUntil(rule, after);
  // The end condition is checked in exactly one place, so every caller —
  // completion, preview, anything later — agrees on when a rule stops.
  if (next !== null && rule.until !== null && next > rule.until) return null;
  return next;
}

function nextIgnoringUntil(rule: Recurrence, after: string): string | null {
  const limit = scanLimitDays(rule);

  if (rule.mode === 'fromCompletion') {
    if (rule.freq === 'weekly' && rule.count === 'occurrences') {
      // The interval-th matching day strictly after the completion — counting
      // is the whole computation, no snap step.
      const wanted = new Set(rule.weekdays.filter((d) => d >= 0 && d <= 6));
      if (wanted.size === 0) return null;
      let seen = 0;
      let candidate = after;
      for (let i = 0; i < limit; i++) {
        candidate = addDays(candidate, 1);
        if (wanted.has(weekdayOf(candidate)) && ++seen === Math.max(1, rule.interval)) {
          return candidate;
        }
      }
      return null;
    }
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

export interface OccurrencePreview {
  dates: string[];
  /** True when the rule stops within (or at the end of) the previewed span. */
  ends: boolean;
}

/**
 * The next few dates a rule will actually produce, for the editor to show —
 * a rule assembled from controls is easy to get subtly wrong, and a list of
 * concrete dates is the fastest way to see what was really built.
 */
export function previewOccurrences(rule: Recurrence, from: string, max: number): OccurrencePreview {
  const dates: string[] = [];
  const budget = rule.remaining !== null ? Math.min(max, Math.max(0, rule.remaining)) : max;
  let cursor = from;

  for (let i = 0; i < budget; i++) {
    const next = nextOccurrence(rule, cursor);
    if (next === null) return { dates, ends: true };
    dates.push(next);
    cursor = next;
  }

  if (rule.remaining !== null && rule.remaining <= max) return { dates, ends: true };
  // One occurrence past the window tells us whether an `until` lands inside it.
  return { dates, ends: dates.length > 0 && nextOccurrence(rule, cursor) === null };
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

function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function dayPhrase(day: number): string {
  return day === -1 ? 'last day' : `day ${day}`;
}

function daysPhrase(days: number[]): string {
  // Last-day sorts after the numbered days rather than before them.
  const ordered = [...days].sort((a, b) => (a === -1 ? 32 : a) - (b === -1 ? 32 : b));
  return ordered.map(dayPhrase).join(', ');
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
      const dayList =
        ordered.length === 7 ? 'any day' : ordered.map((d) => WEEKDAY_ABBR[d]).join(' ');
      if (rule.count === 'occurrences' && rule.interval > 1) {
        parts.push(`every ${ordinal(rule.interval)} of`, dayList);
      } else {
        parts.push(everyPhrase(rule.interval, 'week'));
        if (ordered.length === 7) parts.push('every day');
        else if (ordered.length > 0) parts.push(dayList);
      }
      break;
    }

    case 'monthlyByDate':
      parts.push(everyPhrase(rule.interval, 'month'), daysPhrase(rule.days));
      break;

    case 'monthlyByWeekday':
      parts.push(
        everyPhrase(rule.interval, 'month'),
        `${POSITION_NAMES[rule.week] ?? 'first'} ${WEEKDAY_ABBR[rule.weekday] ?? ''}`.trim(),
      );
      break;

    case 'yearlyByDate':
      parts.push(everyPhrase(rule.interval, 'year'), monthsPhrase(rule.months), dayPhrase(rule.day));
      break;

    case 'yearlyByWeekday':
      parts.push(
        everyPhrase(rule.interval, 'year'),
        monthsPhrase(rule.months),
        `${POSITION_NAMES[rule.week] ?? 'first'} ${WEEKDAY_ABBR[rule.weekday] ?? ''}`.trim(),
      );
      break;
  }

  if (rule.mode === 'fromCompletion') parts.push('from completion');
  if (rule.until !== null) {
    const { month } = yearMonthOf(rule.until);
    parts.push(`until ${dayOf(rule.until)} ${MONTH_NAMES[month - 1]}`);
  }
  if (rule.remaining !== null) {
    parts.push(rule.remaining === 1 ? '1 time left' : `${rule.remaining} times left`);
  }

  return parts.filter(Boolean).join(' · ');
}

/**
 * The days a weekly rule falls on, as short as they go: "daily" for all seven,
 * "Mon–Fri" for a contiguous run, "Mon Thu" for anything scattered.
 *
 * A range needs three days to be worth reading — "Mon–Tue" is longer than
 * "Mon Tue" and says less. Empty is possible in the model and impossible in
 * the editor; it returns nothing and lets the caller fall back to the interval.
 */
function weekdaysPhrase(weekdays: number[]): string {
  const ordered = DISPLAY_ORDER.filter((d) => weekdays.includes(d));
  if (ordered.length === 0) return '';
  if (ordered.length === 7) return 'daily';

  const places = ordered.map((d) => DISPLAY_ORDER.indexOf(d));
  const runs = places.every((p, i) => i === 0 || p === places[i - 1]! + 1);
  if (runs && ordered.length >= 3) {
    return `${WEEKDAY_ABBR[ordered[0]!]}–${WEEKDAY_ABBR[ordered[ordered.length - 1]!]}`;
  }
  return ordered.map((d) => WEEKDAY_ABBR[d]).join(' ');
}

/** "1st", "15th", "last day" — the day-of-month selectors, compactly. */
function shortDaysPhrase(days: number[]): string {
  const ordered = [...days].sort((a, b) => (a === -1 ? 32 : a) - (b === -1 ? 32 : b));
  return ordered.map((day) => (day === -1 ? 'last day' : ordinal(day))).join(', ');
}

/** "first Mon", "last Fri" — a position in the month. */
function positionPhrase(week: number, weekday: number): string {
  return `${POSITION_NAMES[week] ?? 'first'} ${WEEKDAY_ABBR[weekday] ?? ''}`.trim();
}

/** `every 3 months · ` when the interval bites, nothing when it doesn't. */
function intervalPrefix(interval: number, unit: string): string {
  return interval <= 1 ? '' : `every ${interval} ${unit}s · `;
}

/**
 * The same rule at a glance, for a list row.
 *
 * A row has one line for this, and on a run of similar tasks the full
 * description is both the longest thing on the line and the least
 * distinguishing — three tasks that all say "every week · Mon Tue Wed Thu Fri
 * · from completion" have spent their width agreeing with each other.
 *
 * So this says how often and on which days, and deliberately drops what a row
 * can't act on: whether it counts from completion, when it stops, how many
 * repeats are left. Those are mechanism, and they are one click away in the
 * panel where they can be read properly.
 */
export function shortRecurrence(rule: Recurrence): string {
  switch (rule.freq) {
    case 'daily':
      return rule.interval <= 1 ? 'daily' : `every ${rule.interval} days`;

    case 'weekly': {
      const days = weekdaysPhrase(rule.weekdays);
      if (days === '') return rule.interval <= 1 ? 'weekly' : `every ${rule.interval} weeks`;
      // Counting occurrences rather than weeks: "every 2nd · Mon–Fri" is every
      // second matching day, which is a different rhythm from every 2nd week.
      if (rule.count === 'occurrences' && rule.interval > 1) {
        return `every ${ordinal(rule.interval)} · ${days}`;
      }
      return `${intervalPrefix(rule.interval, 'week')}${days}`;
    }

    case 'monthlyByDate':
      return `${intervalPrefix(rule.interval, 'month')}${shortDaysPhrase(rule.days)}`;

    case 'monthlyByWeekday':
      return `${intervalPrefix(rule.interval, 'month')}${positionPhrase(rule.week, rule.weekday)}`;

    case 'yearlyByDate':
      return `${intervalPrefix(rule.interval, 'year')}${monthsPhrase(rule.months)} ${ordinal(rule.day)}`;

    case 'yearlyByWeekday':
      return `${intervalPrefix(rule.interval, 'year')}${monthsPhrase(rule.months)} · ${positionPhrase(rule.week, rule.weekday)}`;
  }
}

/**
 * The preview as one display-ready line: "Sat 22 Aug · Sat 5 Sep · …", with
 * years shown only when they differ from the starting date's, and an explicit
 * "then ends" when the rule stops inside the window.
 */
export function describePreview(rule: Recurrence, from: string, max: number): string {
  const { dates, ends } = previewOccurrences(rule, from, max);
  if (dates.length === 0) return 'No upcoming dates.';

  const refYear = yearMonthOf(from).year;
  const labels = dates.map((date) => {
    const { year } = yearMonthOf(date);
    const base = shortDate(date);
    return year === refYear ? base : `${base} ${year}`;
  });

  return `Next: ${labels.join(' · ')}${ends ? ' · then ends' : ' · …'}`;
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
  const base = { interval: 1, anchor: from, mode: 'grid' as const, until: null, remaining: null };
  const { month } = yearMonthOf(from);

  switch (frequency) {
    case 'daily':
      return { freq: 'daily', ...base, mode: 'fromCompletion' };
    case 'weekly':
      return { freq: 'weekly', weekdays: [weekdayOf(from)], count: 'weeks', ...base };
    case 'monthly':
      return { freq: 'monthlyByDate', days: [dayOf(from)], ...base };
    case 'yearly':
      return { freq: 'yearlyByDate', months: [month], day: dayOf(from), ...base };
  }
}

export { dayOf, dateOf };
