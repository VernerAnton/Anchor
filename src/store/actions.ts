import type { Priority, Project, Task } from '../types/task';
import { PROJECT_COLOR_IDS } from '../types/task';
import { repository } from './index';
import {
  completeTask,
  editProject,
  editTask,
  emptyTaskDraft,
  newProject,
  newTask,
  nextOrder,
  refileTask,
  reopenTask,
  type ProjectDraft,
  type TaskDraft,
} from './mutations';

/**
 * The app's writes, one function each: mutation, then save.
 *
 * This is where write handlers live instead of in a component — the previous
 * build kept every one inside a 600-line App. Each returns a promise that
 * rejects if any save failed, so the caller can report it.
 */

async function saveAll(tasks: readonly Task[]): Promise<void> {
  await Promise.all(tasks.map((task) => repository.saveTask(task)));
}

const subtasksOf = (task: Task, tasks: readonly Task[]) =>
  tasks.filter((candidate) => candidate.parentId === task.id);

// ── Tasks ──────────────────────────────────────────────────────────────────

/** What a new task inherits from where it was added. */
export interface AddContext {
  dueDate: string | null;
  projectId: string | null;
  parentId: string | null;
}

export function addTask(title: string, context: AddContext, tasks: readonly Task[]): Promise<void> {
  // A subtask belongs wherever its parent does; it never picks its own project.
  const parent = context.parentId ? tasks.find((task) => task.id === context.parentId) : undefined;
  const draft: TaskDraft = {
    ...emptyTaskDraft(),
    title,
    dueDate: context.dueDate,
    projectId: parent ? parent.projectId : context.projectId,
    parentId: parent ? parent.id : null,
  };
  return repository.saveTask(newTask(draft, nextOrder(tasks), Date.now()));
}

export function updateTask(task: Task, changes: Partial<TaskDraft>): Promise<void> {
  return repository.saveTask(editTask(task, changes, Date.now()));
}

export function setTaskPriority(task: Task, priority: Priority | null): Promise<void> {
  return updateTask(task, { priority });
}

export function setTaskDone(task: Task, done: boolean): Promise<void> {
  const now = Date.now();
  return repository.saveTask(done ? completeTask(task, now) : reopenTask(task, now));
}

export function setTaskProject(
  task: Task,
  projectId: string | null,
  tasks: readonly Task[],
): Promise<void> {
  return saveAll(refileTask(task, subtasksOf(task, tasks), projectId, Date.now()));
}

/** A task and its subtasks go together — a subtask with no parent is no one's. */
export async function deleteTask(task: Task, tasks: readonly Task[]): Promise<void> {
  const ids = [task.id, ...subtasksOf(task, tasks).map((sub) => sub.id)];
  await Promise.all(ids.map((id) => repository.deleteTask(id)));
}

// ── Projects ───────────────────────────────────────────────────────────────

/** Creates a project and returns its id, so the caller can go straight to it. */
export async function addProject(
  draft: Omit<ProjectDraft, 'colorId'> & Partial<Pick<ProjectDraft, 'colorId'>>,
  projects: readonly Project[],
): Promise<string> {
  const colorId = draft.colorId ?? PROJECT_COLOR_IDS[projects.length % PROJECT_COLOR_IDS.length]!;
  const project = newProject({ ...draft, colorId }, nextOrder(projects), Date.now());
  await repository.saveProject(project);
  return project.id;
}

export function updateProject(project: Project, changes: Partial<ProjectDraft>): Promise<void> {
  return repository.saveProject(editProject(project, changes, Date.now()));
}

/**
 * Archiving a project takes its sub-projects with it — they live inside it.
 * Unarchiving brings back only the one asked for.
 */
export async function setProjectArchived(
  project: Project,
  archived: boolean,
  projects: readonly Project[],
): Promise<void> {
  const now = Date.now();
  const affected = archived
    ? [project, ...projects.filter((p) => p.parentId === project.id && !p.archived)]
    : [project];
  await Promise.all(
    affected.map((p) => repository.saveProject(editProject(p, { archived }, now))),
  );
}

/** Only ever offered for a project nothing has been filed under. */
export function deleteProject(project: Project): Promise<void> {
  return repository.deleteProject(project.id);
}
