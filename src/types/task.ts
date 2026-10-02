/**
 * The library — what exists, as opposed to what's scheduled.
 *
 * A Task is a thing you might do. It is not a thing scheduled on a day: it
 * carries a `dueDate` today, and the library and any future schedule stay
 * separate so the same task could one day appear on more than one day without
 * either owning it.
 *
 * Every absent value is an explicit `null`, never an optional field. Firestore
 * rejects an entire write if any field is `undefined`, and `notes?: string` is
 * exactly how one slips in.
 *
 * The shape is the whole model the chosen scope needs (see
 * `handover/scope-chosen.md`), even where the UI for a field arrives in a later
 * phase. Adding a field to a synced document means a migration across
 * devices; carrying a `null` costs nothing.
 */

/**
 * Identity colours for projects and labels. Only ids live here — the actual
 * colour values are theme tokens (`--project-steel` etc.), so a restyle never
 * touches the data model.
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

/**
 * Where a task belongs. Exactly one per task (or none). Nests one level: a
 * project with a parent never has children.
 */
export interface Project {
  id: string;
  name: string;
  /** An id, never a hex value — the colour itself is a theme token. */
  colorId: ProjectColor;
  /** `null` = top level. */
  parentId: string | null;
  /** Manual ordering in the sidebar. */
  order: number;
  /**
   * Archived rather than deleted, so a task filed here can still say where
   * its work came from.
   */
  archived: boolean;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

/** 1 is the strongest pull. Absent (`null`) sorts last and is not a P5. */
export type Priority = 1 | 2 | 3 | 4;

/**
 * Recurrence, as explicit rules — no natural-language parsing anywhere. The
 * engine that reads these arrives in phase 3 (lifted from
 * `archive/src/lib/recurrence.ts`); the stored shape is fixed now.
 *
 * Weekdays use JavaScript's convention: 0 = Sunday … 6 = Saturday. Months are
 * 1-based. A `week` of 1–4 counts from the start of the month; -1 means the
 * last one. A `day` of -1 means the last day of the month, which is different
 * from 31 — 31 clamps to the month's length, while -1 tracks it.
 */
export type RecurrenceSpec =
  | { freq: 'daily' }
  /**
   * `count` chooses what the interval counts. `'weeks'`: interval 2 over
   * Mon–Fri means the weekdays of alternate weeks. `'occurrences'`: every
   * second matching day — Mon, Wed, Fri, Tue, Thu, …
   */
  | { freq: 'weekly'; weekdays: number[]; count: 'weeks' | 'occurrences' }
  /** Several days per month are allowed — "the 1st and the 15th" is one rule. */
  | { freq: 'monthlyByDate'; days: number[] }
  | { freq: 'monthlyByWeekday'; week: number; weekday: number }
  | { freq: 'yearlyByDate'; months: number[]; day: number }
  | { freq: 'yearlyByWeekday'; months: number[]; week: number; weekday: number };

/**
 * `grid` keeps the rule on the calendar however late you are.
 * `fromCompletion` measures from when you actually finished.
 */
export type RecurrenceMode = 'grid' | 'fromCompletion';

export type Recurrence = RecurrenceSpec & {
  interval: number;
  /** Phase reference for `interval > 1` — which Saturday is "every other". */
  anchor: string | null;
  mode: RecurrenceMode;
  /** Last date the rule may produce; `null` runs forever. */
  until: string | null;
  /** Occurrences left; `null` is unlimited. */
  remaining: number | null;
};

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  projectId: string | null;
  /** One level of subtasks. `null` = top level; a task with a parent has no children. */
  parentId: string | null;
  priority: Priority | null;
  /** YYYY-MM-DD, entered explicitly. `null` is an ordinary backlog task. */
  dueDate: string | null;
  recurrence: Recurrence | null;
  /**
   * When it happened — the only progress the model stores. Every other state
   * (earlier, today, upcoming) is derived at render time. Nothing stores
   * "missed". Recurring tasks never set this; completion advances `dueDate`.
   */
  completedAt: number | null;
  /** Label ids — a set, stored as an array because Firestore has no set type. */
  labelIds: string[];
  /** Manual ordering. */
  order: number;
  archived: boolean;

  schemaVersion: number;
  /** Conflict resolution. Bumped synchronously, before any async work. */
  version: number;
  /** Display and ordering only — never conflict resolution. */
  updatedAt: number;
}
