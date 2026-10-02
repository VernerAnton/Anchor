import type { Project, Task } from '../types/task';
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
