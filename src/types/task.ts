/**
 * The library — what exists, as opposed to what's scheduled.
 *
 * A Task is a thing you might do. Later phases add Points: a task placed on a
 * day at a time. Keeping them separate is what lets the same task appear on
 * Tuesday and next Tuesday without either day owning it. The task manager is
 * the foundation; the path is one lens over it.
 *
 * Every absent value is an explicit `null`, never an optional field. Firestore
 * rejects an entire write if any field is `undefined`, and `label?: string` is
 * exactly how one slips in.
 */

/**
 * Project colours are a different axis from the four that carry meaning on the
 * path (ember/acid/cyan/slate). The grammar is: **neon means state, muted means
 * identity.** Only the ids live here — the actual colour values are theme
 * tokens (`--project-steel` etc.), so a restyle never touches this file.
 */
export const PROJECT_COLOR_IDS = [
  'steel',
  'violet',
  'teal',
  'sage',
  'ochre',
  'plum',
  'indigo',
  'clay',
] as const;

export type ProjectColor = (typeof PROJECT_COLOR_IDS)[number];

export interface Project {
  id: string;
  name: string;
  colorId: ProjectColor;
  /** Projects nest. `null` means top level. */
  parentId: string | null;
  /** Manual ordering in the sidebar. */
  order: number;
  /**
   * Archived rather than deleted. Future scheduled days will carry a snapshot
   * of the project they were scheduled under, and a past day should still be
   * able to say where its work came from.
   */
  archived: boolean;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

/**
 * Priority exists to order a backlog, where sorting is the actual job. It is a
 * planning concept only and will never reach a scheduled Point — at the moment
 * of doing, a second axis of importance is one more decision at the worst
 * possible time.
 */
export type Priority = 1 | 2 | 3 | 4;

/** How long a thing runs when it's eventually placed on a path. */
export type Duration =
  | { kind: 'fixed'; minutes: number }
  | { kind: 'natural'; estimateMinutes: number };

export type TaskType = 'physical' | 'abstract';

/**
 * Recurrence, as explicit rules — no natural-language parsing anywhere.
 *
 * Weekdays use JavaScript's convention: 0 = Sunday … 6 = Saturday. Months are
 * 1-based. A `week` of 1–4 counts from the start of the month; -1 means the
 * last one. A `day` of -1 means the last day of the month, which is different
 * from 31 — 31 clamps to the month's length, while -1 tracks it.
 */
export type RecurrenceSpec =
  | { freq: 'daily' }
  /**
   * `count` chooses what the interval counts. `'weeks'` is the calendar
   * reading: interval 2 over Mon–Fri means the weekdays of alternate weeks.
   * `'occurrences'` counts matching days themselves: interval 2 over Mon–Fri
   * means every second weekday — Mon, Wed, Fri, Tue, Thu, … Only weekly has
   * the distinction; every other frequency yields at most one occurrence per
   * calendar unit, so the two readings coincide.
   */
  | { freq: 'weekly'; weekdays: number[]; count: 'weeks' | 'occurrences' }
  /** Several days per month are allowed — "the 1st and the 15th" is one rule. */
  | { freq: 'monthlyByDate'; days: number[] }
  | { freq: 'monthlyByWeekday'; week: number; weekday: number }
  | { freq: 'yearlyByDate'; months: number[]; day: number }
  | { freq: 'yearlyByWeekday'; months: number[]; week: number; weekday: number };

/**
 * How the next date is found once a task is completed.
 *
 * `grid` keeps the rule on the calendar — every other Saturday stays on its
 * Saturdays however late you are. `fromCompletion` measures from when you
 * actually finished, so the rhythm follows you rather than accumulating
 * against a schedule you didn't keep.
 */
export type RecurrenceMode = 'grid' | 'fromCompletion';

export type Recurrence = RecurrenceSpec & {
  /** Every N days / weeks / months / years — or matching days, for weekly `'occurrences'`. */
  interval: number;
  /**
   * Phase reference, and the reason "every other Saturday" is answerable at
   * all — without a fixed point, which Saturday is the on-week is undefined.
   * Only consulted when `interval > 1`.
   */
  anchor: string | null;
  mode: RecurrenceMode;
  /** Last date the rule may produce; `null` means it runs forever. */
  until: string | null;
  /**
   * Occurrences left; `null` means unlimited. Decremented on each completion —
   * "repeat 5 times" needs its count kept somewhere, and the rule on the task
   * is where the schedule already lives. When it runs out the task completes
   * like a non-recurring one.
   */
  remaining: number | null;
};

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  projectId: string | null;
  /** Flat subtasks: one level deep, `null` for a top-level task. */
  parentId: string | null;
  priority: Priority | null;
  /** YYYY-MM-DD, entered explicitly. `null` means no date — a backlog task. */
  dueDate: string | null;
  recurrence: Recurrence | null;
  /**
   * When it happened. Recurring tasks never set this — completion advances
   * `dueDate` instead, so the task stays live for its next occurrence.
   */
  completedAt: number | null;
  /** Manual ordering within a project. */
  order: number;
  archived: boolean;

  // Path-era fields, carried now so the library is path-ready without a
  // migration. All nullable: a plain to-do doesn't need them yet.
  /** The smallest move that starts it. Copied onto each scheduled Point. */
  firstMove: string | null;
  type: TaskType | null;
  /** What a Point gets when this task is scheduled, before any per-day tweak. */
  defaultDuration: Duration | null;
  /** 'HH:MM', 24h local. The time used on any day with no override. */
  startTime: string | null;
  /**
   * Weekday (0 = Sunday … 6 = Saturday, as string keys) → 'HH:MM'. Overrides
   * `startTime` on that weekday, so the gym can sit at 07:00 on weekdays and
   * 10:00 on Saturday without becoming two tasks.
   *
   * Keyed by weekday rather than by date because the app's unit is a repeating
   * week: a date-keyed table would need a fresh entry for every future
   * occurrence and would stop applying the moment the week rolled over. Rules
   * that aren't weekly land on varying weekdays and simply use `startTime`.
   */
  weekdayTimes: Record<string, string>;

  schemaVersion: number;
  version: number;
  updatedAt: number;
}
