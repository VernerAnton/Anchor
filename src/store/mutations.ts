import type { Task } from '../types/task';
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

/** The order a new task takes at the end of the list it joins. */
export function nextOrder(tasks: readonly Task[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.order), 0) + 1;
}

export function editTask(task: Task, changes: Partial<TaskDraft>, now: number): Task {
  return touch({ ...task, ...changes }, now);
}

/**
 * It happened. Recurring completion — advancing `dueDate` instead of closing
 * the task — arrives with the recurrence engine in phase 3; until then nothing
 * can create a rule, so every task completes like this.
 */
export function completeTask(task: Task, now: number): Task {
  return touch({ ...task, completedAt: now }, now);
}

/** Undoes a completion. Mis-taps happen, and a wrong record is worse than none. */
export function reopenTask(task: Task, now: number): Task {
  return touch({ ...task, completedAt: null }, now);
}
