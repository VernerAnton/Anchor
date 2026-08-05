import type { Priority, Project, ProjectColor, Recurrence, Task } from '../types/task';
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
  if (task.recurrence) {
    const next = nextOccurrence(task.recurrence, recurrenceBase(task.dueDate, today));
    // A rule that can't produce a date leaves the task where it is rather than
    // being handed an invented one. It stays visible, which is the honest
    // outcome — a silently wrong date would be worse than none.
    return next === null ? task : touch({ ...task, dueDate: next });
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

export function editProject(
  project: Project,
  changes: Partial<Pick<Project, 'name' | 'colorId' | 'parentId' | 'order' | 'archived'>>,
): Project {
  return touch({ ...project, ...changes });
}
