/**
 * The path's own layer: what order things happen in, at what time, and what
 * sits between them.
 *
 * Deliberately separate from `Task`. A task is *what* you might do and *how
 * often*; a path entry is *where in a day it sits*. Keeping them apart is what
 * stops rearranging a morning from rearranging your task list, and it is why
 * the same task can appear on a day twice — two entries, two ids, no
 * connection between them.
 *
 * Entries reference tasks and never copy them. Renaming a task renames it
 * everywhere it appears, because there is only one of it.
 */

/** A task placed on a day. `startTime` is that placement's clock, not the task's. */
export interface TaskEntry {
  kind: 'task';
  id: string;
  taskId: string;
  /** 'HH:MM', or null to simply follow whatever came before it. */
  startTime: string | null;
}

/**
 * Rest, placed rather than calculated. A rest card *is* the gap: it has a
 * length you chose and, optionally, a name for what you're doing with it.
 *
 * No completable-shaped field, and never will be — rest exists to be
 * legitimate, not to be ticked off.
 */
export interface RestEntry {
  kind: 'rest';
  id: string;
  /** "Shower, eat" — or null for plain rest. */
  label: string | null;
  minutes: number;
}

/**
 * A hole committed to in advance, for whatever the week throws at you.
 *
 * The point of it: a fixed week and real life disagree, and without somewhere
 * for the unplanned to go, every stray errand drags you back into the builder
 * to edit a pattern you had deliberately stopped touching. A wildcard means
 * the decision was already made — only the contents are new.
 *
 * What goes in one is a fact about a specific date, so it lives in `DayLog`,
 * not here. An unfilled wildcard reads as open time, so having one never
 * creates an obligation.
 */
export interface WildcardEntry {
  kind: 'wildcard';
  id: string;
  startTime: string | null;
  minutes: number;
}

export type PathEntry = TaskEntry | RestEntry | WildcardEntry;

/**
 * The whole week, as one document.
 *
 * One rather than seven: it is edited as a unit, it is small, and a single
 * document cannot half-save. Order is the array's own order — there is no sort
 * field to keep consistent, and moving something is a splice.
 */
export interface PathPattern {
  /** Weekday (0 = Sunday … 6 = Saturday, as string keys) → entries, in order. */
  days: Record<string, PathEntry[]>;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

/**
 * What actually happened on one date, and what you decided to put in that
 * date's wildcards.
 *
 * Both are facts about a specific day rather than about the pattern, which is
 * why they live here. Completion is keyed by entry id, which is what lets the
 * morning study session be done while the afternoon one isn't, even though
 * both point at the same task.
 *
 * Written only when something happens. A day you never touched has no document
 * at all and stays a genuine gap — nothing stores "missed".
 */
export interface DayLog {
  date: string;
  /** Entry id → when it was cleared. */
  cleared: Record<string, number>;
  /** Wildcard entry id → the task ids put in it that day, in order. */
  wildcards: Record<string, string[]>;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}
