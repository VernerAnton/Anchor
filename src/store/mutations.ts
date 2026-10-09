import type { Label, Project, ProjectColor, Recurrence, Task } from '../types/task';
import { matches, nextOccurrence, recurrenceBase } from '../lib/recurrence';
import { newId } from '../lib/id';
import { SCHEMA_VERSION } from './keys';

/**
 * Every change to stored data, as pure functions.
 *
 * The app calls `repository.saveTask(completeTask(task, now))`, and the only
 * thing that knows about storage is `saveTask`. A mutation can be reasoned
 * about — and tested — without a store at all.
 *
 * `touch` stamps the write. The version bump is synchronous and happens before
 * anything async, so by the time a write is in flight the new document already
 * carries the higher version and a stale echo of the previous write can never
 * overwrite it.
 */
function touch<T extends { version: number; updatedAt: number }>(doc: T, now: number): T {
  return { ...doc, version: doc.version + 1, updatedAt: now };
}

/** The fields a person edits. Never progress — that isn't edited, it happens. */
export type TaskDraft = Pick<
  Task,
  'title' | 'notes' | 'projectId' | 'parentId' | 'priority' | 'dueDate' | 'recurrence' | 'labelIds'
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
    labelIds: [],
  };
}

export function newTask(draft: TaskDraft, order: number, now: number): Task {
  return {
    id: newId(),
    ...draft,
    completedAt: null,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: now,
  };
}

/** The order a new document takes after everything already there. */
export function nextOrder(docs: readonly { order: number }[]): number {
  return docs.reduce((max, doc) => Math.max(max, doc.order), 0) + 1;
}

export function editTask(task: Task, changes: Partial<TaskDraft>, now: number): Task {
  return touch({ ...task, ...changes }, now);
}

/**
 * It happened. A recurring task never closes — completion advances its due
 * date to the next occurrence instead, measured from the later of today and
 * the due date, so a rule that has gone by doesn't backfill a queue of
 * occurrences. Nothing stores "missed"; that includes recurrence.
 */
export function completeTask(task: Task, now: number, today: string): Task {
  const rule = task.recurrence;
  if (rule) {
    const next = nextOccurrence(rule, recurrenceBase(task.dueDate, today));
    // The rule has run its course — past its until-date, out of repeats, or
    // shaped so no date exists. This completion is its last: the task closes
    // like any other, keeping the rule as a record of how it used to repeat.
    const lastRepeat = rule.remaining !== null && rule.remaining <= 1;
    if (next === null || lastRepeat) return touch({ ...task, completedAt: now }, now);
    return touch(
      {
        ...task,
        dueDate: next,
        recurrence: rule.remaining === null ? rule : { ...rule, remaining: rule.remaining - 1 },
      },
      now,
    );
  }
  return touch({ ...task, completedAt: now }, now);
}

/** Whether completing this task moves it on rather than closing it. */
export function completionAdvances(task: Task, today: string): boolean {
  return completeTask(task, 0, today).completedAt === null;
}

/** Undoes a completion. Mis-taps happen, and a wrong record is worse than none. */
export function reopenTask(task: Task, now: number): Task {
  return touch({ ...task, completedAt: null }, now);
}

/**
 * Files a task under a project, and its subtasks with it. A subtask has no
 * project of its own to choose — it belongs where its parent does — so moving
 * the parent is one change to every document involved, returned together so
 * the caller writes them all.
 */
export function refileTask(
  task: Task,
  subtasks: readonly Task[],
  projectId: string | null,
  now: number,
): Task[] {
  return [task, ...subtasks]
    .filter((doc) => doc.projectId !== projectId)
    .map((doc) => touch({ ...doc, projectId }, now));
}

/**
 * Moves a task to a date — and moves its rhythm with it.
 *
 * The rule keeps its shape; what changes is where the counting starts.
 * "Every other weekday" moved from Monday to Tuesday runs Tue, Thu, Mon,
 * because the anchor — the fixed point an interval counts from — follows the
 * task to its new date. A `fromCompletion` rule never reads its anchor, so for
 * those this is a plain date change.
 */
export function rescheduleTask(task: Task, date: string, now: number = Date.now()): Task {
  const rule = task.recurrence;
  return touch(
    { ...task, dueDate: date, recurrence: rule === null ? null : { ...rule, anchor: date } },
    now,
  );
}

/**
 * Sets (or clears) a task's rule. A rule without an anchor counts from the
 * task's own date. A repeating task with no date at all gets its first
 * occurrence — a rule that never puts the task on a day would be a rule in
 * name only.
 */
export function setTaskRecurrence(
  task: Task,
  recurrence: Recurrence | null,
  today: string,
  now: number,
): Task {
  if (recurrence === null) return touch({ ...task, recurrence: null }, now);
  const rule = { ...recurrence, anchor: recurrence.anchor ?? task.dueDate ?? today };
  const dueDate = task.dueDate ?? (matches(rule, today) ? today : nextOccurrence(rule, today));
  return touch({ ...task, recurrence: rule, dueDate }, now);
}

/** A new position in a manually ordered list. */
export function setTaskOrder(task: Task, order: number, now: number): Task {
  return touch({ ...task, order }, now);
}

// ── Labels on tasks ────────────────────────────────────────────────────────

/**
 * Puts labels on a task, ignoring any it already carries. One write for the
 * whole list: a pasted "focus, deep work, errand" applied a label at a time
 * would read the same stale task three times and keep only the last.
 * Returns the task itself when nothing changes.
 */
export function addTaskLabels(task: Task, labelIds: readonly string[], now: number): Task {
  const added = labelIds.filter((id, i) => !task.labelIds.includes(id) && labelIds.indexOf(id) === i);
  return added.length === 0 ? task : touch({ ...task, labelIds: [...task.labelIds, ...added] }, now);
}

/** Takes a label off a task. Safe to run over tasks that never carried it. */
export function removeTaskLabel(task: Task, labelId: string, now: number): Task {
  return task.labelIds.includes(labelId)
    ? touch({ ...task, labelIds: task.labelIds.filter((id) => id !== labelId) }, now)
    : task;
}

// ── Labels ─────────────────────────────────────────────────────────────────

export function newLabel(name: string, colorId: ProjectColor, order: number, now: number): Label {
  return {
    id: newId(),
    name,
    colorId,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: now,
  };
}

export function editLabel(
  label: Label,
  changes: Partial<Pick<Label, 'name' | 'colorId' | 'order'>>,
  now: number,
): Label {
  return touch({ ...label, ...changes }, now);
}

/**
 * Swaps two labels' places. Only the two that moved are written, so two
 * devices reordering different parts of the list don't fight over every row.
 */
export function swapLabelOrder(a: Label, b: Label, now: number): [Label, Label] {
  return [touch({ ...a, order: b.order }, now), touch({ ...b, order: a.order }, now)];
}

// ── Projects ───────────────────────────────────────────────────────────────

export type ProjectDraft = Pick<Project, 'name' | 'colorId' | 'parentId'>;

export function newProject(draft: ProjectDraft, order: number, now: number): Project {
  return {
    id: newId(),
    ...draft,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: now,
  };
}

export function editProject(
  project: Project,
  changes: Partial<ProjectDraft & Pick<Project, 'archived'>>,
  now: number,
): Project {
  return touch({ ...project, ...changes }, now);
}
