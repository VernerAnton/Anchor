import type { Task } from '../types/task';
import { repository } from './index';
import { completeTask, emptyTaskDraft, newTask, nextOrder, reopenTask } from './mutations';

/**
 * The app's writes, one function each: mutation, then save.
 *
 * This is where write handlers live instead of in a component — the previous
 * build kept every one inside a 600-line App. Each returns the save's promise,
 * so the caller can report a write that failed.
 */

export function addTask(title: string, tasks: readonly Task[]): Promise<void> {
  const draft = { ...emptyTaskDraft(), title };
  return repository.saveTask(newTask(draft, nextOrder(tasks), Date.now()));
}

export function setTaskDone(task: Task, done: boolean): Promise<void> {
  const now = Date.now();
  return repository.saveTask(done ? completeTask(task, now) : reopenTask(task, now));
}

export function deleteTask(task: Task): Promise<void> {
  return repository.deleteTask(task.id);
}
