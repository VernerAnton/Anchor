import type { Task } from '../types/task';

/**
 * What each view shows, as data. Pure functions: tasks in, rows out.
 *
 * Components never work out whether a task is done, where it sorts or which
 * section it belongs to — they receive `status: 'done'` and render it. That is
 * the rule that lets two wildly different themes share every line of logic.
 */

export type TaskStatus = 'open' | 'done';

/** Everything a row needs, already decided. */
export interface TaskRowModel {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface ListModel {
  open: TaskRowModel[];
  /** Newest first. */
  completed: TaskRowModel[];
}

export function taskStatus(task: Task): TaskStatus {
  return task.completedAt === null ? 'open' : 'done';
}

function toRow(task: Task): TaskRowModel {
  return { id: task.id, title: task.title, status: taskStatus(task) };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * The stable tail every comparator ends on. Without it, adding one task
 * somewhere else could reshuffle rows that had nothing to do with it.
 */
function byTitleThenId(a: Task, b: Task): number {
  return collator.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function byOrder(a: Task, b: Task): number {
  return a.order - b.order || byTitleThenId(a, b);
}

function byNewestCompletion(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0) || byTitleThenId(a, b);
}

/** All tasks — the library. */
export function allTasksView(tasks: readonly Task[]): ListModel {
  const live = tasks.filter((task) => !task.archived);
  return {
    open: live
      .filter((task) => task.completedAt === null)
      .sort(byOrder)
      .map(toRow),
    completed: live
      .filter((task) => task.completedAt !== null)
      .sort(byNewestCompletion)
      .map(toRow),
  };
}

/**
 * Where keyboard focus should land after a row's status changes and it moves
 * out from under the cursor. Completing an open row hands focus to the row
 * that takes its place (or the one above, at the end of the list); reopening
 * a done row follows it into the open list.
 */
export function focusAfterToggle(list: ListModel, id: string, done: boolean): string | null {
  if (!done) return id;
  const index = list.open.findIndex((row) => row.id === id);
  if (index === -1) return id;
  return list.open[index + 1]?.id ?? list.open[index - 1]?.id ?? null;
}

/** What the detail panel shows for one task. `null` when it no longer exists. */
export interface TaskDetailModel {
  id: string;
  title: string;
  status: TaskStatus;
}

export function taskDetail(tasks: readonly Task[], id: string | null): TaskDetailModel | null {
  if (id === null) return null;
  const task = tasks.find((candidate) => candidate.id === id);
  return task ? toRow(task) : null;
}
