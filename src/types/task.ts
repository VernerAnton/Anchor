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
 * `weekdays` uses JavaScript's convention: 0 = Sunday … 6 = Saturday.
 * `monthlyByDate` clamps to the month's length (31 → Apr 30, Feb 28/29).
 */
export type Recurrence =
  | { kind: 'everyNDays'; n: number }
  | { kind: 'weekly'; weekdays: number[] }
  | { kind: 'monthlyByDate'; day: number };

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

  schemaVersion: number;
  version: number;
  updatedAt: number;
}
