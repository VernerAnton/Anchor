import type { Label, Priority, Project, ProjectColor, Recurrence, Task } from '../types/task';
import type {
  DayLog,
  PathEntry,
  PathPattern,
  RestEntry,
  TaskEntry,
  WildcardEntry,
} from '../types/path';
import { PROJECT_COLOR_IDS } from '../types/task';
import { newId } from '../lib/id';
import { nextOccurrence, recurrenceBase } from '../lib/recurrence';
import { SCHEMA_VERSION } from './keys';

/**
 * Every change to stored data, as pure functions.
 *
 * Funnelling writes through one module is what keeps the sync layer honest:
 * the app calls `saveTask(completeTask(task, now, today))`, and the only thing
 * that knows about the network is `saveTask`. It also means a mutation can be
 * reasoned about — and tested — without a store at all.
 *
 * `touch` stamps the write. The version bump is synchronous and happens before
 * anything async — the discipline the working sync layer proved out. By the
 * time a write is in flight, local state already carries the higher version,
 * so a stale echo of the previous write can never overwrite what you just did.
 */
function touch<T extends { version: number; updatedAt: number }>(doc: T): T {
  return { ...doc, version: (doc.version ?? 0) + 1, updatedAt: Date.now() };
}

// ── Tasks ──────────────────────────────────────────────────────────────────

/** The shape the editors collect. Never includes progress — that isn't edited. */
export type TaskDraft = Pick<
  Task,
  | 'title'
  | 'notes'
  | 'projectId'
  | 'parentId'
  | 'priority'
  | 'dueDate'
  | 'recurrence'
  | 'firstMove'
  | 'type'
  | 'defaultDuration'
  | 'labelIds'
>;

export function emptyTaskDraft(): TaskDraft {
  return {
    title: '',
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate: null,
    recurrence: null,
    firstMove: null,
    type: null,
    defaultDuration: null,
    labelIds: [],
  };
}

export function newTask(draft: TaskDraft, order: number): Task {
  return {
    id: newId(),
    ...draft,
    completedAt: null,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}

export function editTask(task: Task, changes: Partial<TaskDraft>): Task {
  return touch({ ...task, ...changes });
}

/**
 * It happened. A recurring task never closes — completion advances its due
 * date to the next occurrence instead, measured from the later of today and
 * the due date so an overdue rule doesn't backfill "missed" occurrences.
 * Nothing stores missed; that includes recurrence.
 */
export function completeTask(task: Task, now: number, today: string): Task {
  const rule = task.recurrence;
  if (rule) {
    const next = nextOccurrence(rule, recurrenceBase(task.dueDate, today));
    // The rule has run its course — past its until-date, out of repeats, or
    // (rarely) shaped so no date exists. This completion is its last: the task
    // closes like a non-recurring one, keeping the rule as a record of how it
    // used to repeat. Reopening just clears the completion; an ended rule
    // stays ended until it is re-edited, with no hidden counter resurrecting.
    const lastRepeat = rule.remaining !== null && rule.remaining <= 1;
    if (next === null || lastRepeat) {
      return touch({ ...task, completedAt: now });
    }
    return touch({
      ...task,
      dueDate: next,
      recurrence: rule.remaining === null ? rule : { ...rule, remaining: rule.remaining - 1 },
    });
  }
  return touch({ ...task, completedAt: now });
}

/** Undoes a completion. Mis-taps happen, and a wrong record is worse than none. */
export function reopenTask(task: Task): Task {
  return touch({ ...task, completedAt: null });
}

/**
 * Archiving rather than deleting is the default for anything a past day might
 * point at — the record should still be able to say where its work came from.
 * Hard delete exists on the repository for things that were never real.
 */
export function archiveTask(task: Task, archived: boolean): Task {
  return touch({ ...task, archived });
}

export function setTaskPriority(task: Task, priority: Priority | null): Task {
  return touch({ ...task, priority });
}

/**
 * Moves a task to a date — and moves its rhythm with it.
 *
 * The rule keeps its shape. "Every other weekday" stays every other weekday;
 * what changes is where the counting starts. Moved from Monday to Tuesday, it
 * runs Tue, Thu, Mon rather than staying on the Mon-Wed-Fri phase it had
 * before, because the anchor — the fixed point an interval counts from —
 * follows the task to its new date.
 *
 * That is the whole reason to move something. The alternative is a rule that
 * insists on a calendar you have already left: shift Monday's task to Tuesday
 * and the old phase would put the next one on Wednesday, one day later, which
 * is not what "every other" meant to anybody.
 *
 * A `fromCompletion` rule never reads its anchor, so for those this is a plain
 * due-date change. Right, too: those already measure from you rather than from
 * a grid, so there is no phase to re-stamp.
 */
export function rescheduleTask(task: Task, date: string): Task {
  const rule = task.recurrence;
  return touch({
    ...task,
    dueDate: date,
    recurrence: rule === null ? null : { ...rule, anchor: date },
  });
}

/**
 * Sets a rule, stamping the phase it should count from when it doesn't carry
 * one. The task's own due date is the natural reference — picking "every other
 * Saturday" on a task due this Saturday should mean *this* Saturday's cadence.
 */
export function setTaskRecurrence(
  task: Task,
  recurrence: Recurrence | null,
  today: string,
): Task {
  if (recurrence === null) return touch({ ...task, recurrence: null });
  const anchor = recurrence.anchor ?? task.dueDate ?? today;
  return touch({ ...task, recurrence: { ...recurrence, anchor } });
}

/*
 * Taking a task off the path used to mean clearing its rule and due date,
 * because a rule was the only thing that put it on a day. It isn't any more:
 * a task is on a day because an entry places it there, so removing that entry
 * is the whole gesture — see `removeEntry` below. Clearing the rule would now
 * do something different and worse, dropping the task out of the day's offer
 * list as well, so it is no longer offered as one action.
 */

// ── The week's pattern ─────────────────────────────────────────────────────

/**
 * Every edit to the week returns a whole new pattern, and every one of them
 * goes through `withDay`, so there is exactly one place that knows how a day's
 * list is stored. Order is the array's own order: moving something is a splice
 * and nothing else has to be kept in step.
 *
 * None of these touch a task. Rearranging a Tuesday cannot change what a task
 * is or how often it happens — that separation is the point of having a
 * pattern at all.
 */

export function emptyPattern(): PathPattern {
  return { days: {}, schemaVersion: SCHEMA_VERSION, version: 0, updatedAt: Date.now() };
}

export function taskEntry(taskId: string, startTime: string | null = null): TaskEntry {
  return { kind: 'task', id: newId(), taskId, startTime };
}

export function restEntry(label: string | null, minutes: number): RestEntry {
  return { kind: 'rest', id: newId(), label, minutes };
}

export function wildcardEntry(startTime: string | null, minutes: number): WildcardEntry {
  return { kind: 'wildcard', id: newId(), startTime, minutes };
}

/** What one weekday holds, in order. Empty for a day never arranged. */
export function entriesOn(pattern: PathPattern | null, weekday: number): PathEntry[] {
  return pattern?.days?.[String(weekday)] ?? [];
}

function withDay(
  pattern: PathPattern | null,
  weekday: number,
  entries: PathEntry[],
): PathPattern {
  const base = pattern ?? emptyPattern();
  return touch({ ...base, days: { ...base.days, [String(weekday)]: entries } });
}

/** Out-of-range indices clamp rather than throw: a drop past the end means the end. */
export function insertEntry(
  pattern: PathPattern | null,
  weekday: number,
  index: number,
  entry: PathEntry,
): PathPattern {
  const entries = [...entriesOn(pattern, weekday)];
  entries.splice(Math.max(0, Math.min(index, entries.length)), 0, entry);
  return withDay(pattern, weekday, entries);
}

export function removeEntry(
  pattern: PathPattern | null,
  weekday: number,
  entryId: string,
): PathPattern {
  return withDay(
    pattern,
    weekday,
    entriesOn(pattern, weekday).filter((entry) => entry.id !== entryId),
  );
}

/**
 * `to` is where it lands in the list *after* it has been lifted out, which is
 * how the drop gaps are numbered — the gap above something is its own index,
 * the gap below is the next one.
 */
export function moveEntry(
  pattern: PathPattern | null,
  weekday: number,
  from: number,
  to: number,
): PathPattern {
  const entries = [...entriesOn(pattern, weekday)];
  const moved = entries[from];
  if (moved === undefined) return pattern ?? emptyPattern();
  entries.splice(from, 1);
  // A drop into the gap below itself has to account for the lift.
  const landing = to > from ? to - 1 : to;
  entries.splice(Math.max(0, Math.min(landing, entries.length)), 0, moved);
  return withDay(pattern, weekday, entries);
}

/**
 * The fields an entry can be edited to have. Kept as one shape rather than
 * three functions because the three kinds overlap: a wildcard has both a clock
 * and a length, rest has a length and a name, a task has only a clock. Each
 * kind takes what it has and ignores the rest, so a caller can't set a length
 * on something that doesn't have one.
 */
export interface EntryChanges {
  /** 'HH:MM' to pin it, null to go back to following whatever is above it. */
  startTime?: string | null;
  minutes?: number;
  label?: string | null;
}

function applyChanges(entry: PathEntry, changes: EntryChanges): PathEntry {
  switch (entry.kind) {
    case 'task':
      return 'startTime' in changes ? { ...entry, startTime: changes.startTime ?? null } : entry;
    case 'rest':
      return {
        ...entry,
        label: 'label' in changes ? (changes.label ?? null) : entry.label,
        minutes: changes.minutes ?? entry.minutes,
      };
    case 'wildcard':
      return {
        ...entry,
        startTime: 'startTime' in changes ? (changes.startTime ?? null) : entry.startTime,
        minutes: changes.minutes ?? entry.minutes,
      };
  }
}

export function editEntry(
  pattern: PathPattern | null,
  weekday: number,
  entryId: string,
  changes: EntryChanges,
): PathPattern {
  return withDay(
    pattern,
    weekday,
    entriesOn(pattern, weekday).map((entry) =>
      entry.id === entryId ? applyChanges(entry, changes) : entry,
    ),
  );
}

// ── The day's log ──────────────────────────────────────────────────────────

export function emptyDayLog(date: string): DayLog {
  return {
    date,
    cleared: {},
    started: {},
    wildcards: {},
    schemaVersion: SCHEMA_VERSION,
    version: 0,
    updatedAt: Date.now(),
  };
}

/**
 * Records that one *placement* was cleared, or un-clears it.
 *
 * Keyed by entry, never by task. The same task placed twice on a day is two
 * entries, and clearing the morning one has to leave the afternoon one alone —
 * which is the whole reason completion lives here rather than on the task.
 *
 * Un-clearing removes the key rather than storing a falsy value: the log says
 * what happened, and "this didn't happen" is the absence of a record, not a
 * record of absence.
 */
export function setEntryCleared(
  log: DayLog | null,
  date: string,
  entryId: string,
  cleared: boolean,
  now: number = Date.now(),
): DayLog {
  const base = log ?? emptyDayLog(date);
  const next = { ...base.cleared };
  if (cleared) next[entryId] = now;
  else delete next[entryId];
  return touch({ ...base, cleared: next });
}

/**
 * Records the moment you began — the one thing the route's action button
 * does.
 *
 * Starting and finishing are different facts, so this never touches
 * `cleared`. Pressing it says "I'm on this now", which is true at the moment
 * you press it; marking the point done there and then would be a lie, and one
 * you'd notice immediately.
 */
export function setEntryStarted(
  log: DayLog | null,
  date: string,
  entryId: string,
  started: boolean,
  now: number = Date.now(),
): DayLog {
  const base = log ?? emptyDayLog(date);
  const next = { ...(base.started ?? {}) };
  if (started) next[entryId] = now;
  else delete next[entryId];
  return touch({ ...base, started: next });
}

/**
 * What went into one wildcard on one date, in the order it runs.
 *
 * A wildcard is a hole the week already agreed to, so what fills it is a fact
 * about the day rather than about the pattern — the same wildcard is
 * something different every Tuesday, and that is the point of it.
 *
 * Taking a task back out drops its completion too. The record was against a
 * placement that no longer exists, and leaving it behind would mean re-adding
 * the task later brought back a tick you never made today.
 */
export function setWildcardTasks(
  log: DayLog | null,
  date: string,
  entryId: string,
  taskIds: string[],
): DayLog {
  const base = log ?? emptyDayLog(date);
  const wildcards = { ...base.wildcards };
  const dropped = (wildcards[entryId] ?? []).filter((id) => !taskIds.includes(id));
  if (taskIds.length === 0) delete wildcards[entryId];
  else wildcards[entryId] = taskIds;

  const cleared = { ...base.cleared };
  const started = { ...(base.started ?? {}) };
  for (const id of dropped) {
    delete cleared[`${entryId}:${id}`];
    delete started[`${entryId}:${id}`];
  }

  return touch({ ...base, wildcards, cleared, started });
}

// ── Projects ───────────────────────────────────────────────────────────────

export function newProject(
  name: string,
  parentId: string | null,
  order: number,
  colorId?: ProjectColor,
): Project {
  return {
    id: newId(),
    name,
    colorId: colorId ?? PROJECT_COLOR_IDS[order % PROJECT_COLOR_IDS.length]!,
    parentId,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}

/**
 * Adds or removes one label on a task.
 *
 * A toggle rather than a set, because that is the whole of the interaction —
 * you press a label, and it is either on or off. Order isn't kept: labels are
 * a set, and the only reason they live in an array is that Firestore has no
 * set type.
 */
export function toggleTaskLabel(task: Task, labelId: string): Task {
  const held = task.labelIds ?? [];
  const next = held.includes(labelId)
    ? held.filter((id) => id !== labelId)
    : [...held, labelId];
  return touch({ ...task, labelIds: next });
}

/**
 * Takes a label off a task, used when the label itself is deleted.
 *
 * Separate from the toggle because it has to be safe to run over every task,
 * including the ones that never carried it — a toggle would happily add it to
 * all of them.
 */
export function stripLabel(task: Task, labelId: string): Task {
  return touch({ ...task, labelIds: (task.labelIds ?? []).filter((id) => id !== labelId) });
}

// ── Labels ─────────────────────────────────────────────────────────────────

export function newLabel(name: string, order: number, colorId?: ProjectColor): Label {
  return {
    id: newId(),
    name,
    colorId: colorId ?? PROJECT_COLOR_IDS[order % PROJECT_COLOR_IDS.length]!,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}

export function editLabel(
  label: Label,
  changes: Partial<Pick<Label, 'name' | 'colorId' | 'order' | 'archived'>>,
): Label {
  return touch({ ...label, ...changes });
}

/**
 * Moves one label up or down the list, returning both labels that changed.
 *
 * A swap rather than a renumber: only the two that moved are written, so
 * reordering a long list is two documents rather than all of them, and two
 * devices reordering different parts of the list don't fight over every row.
 */
export function swapLabelOrder(a: Label, b: Label): [Label, Label] {
  return [touch({ ...a, order: b.order }), touch({ ...b, order: a.order })];
}

export function editProject(
  project: Project,
  changes: Partial<Pick<Project, 'name' | 'colorId' | 'parentId' | 'order' | 'archived'>>,
): Project {
  return touch({ ...project, ...changes });
}
