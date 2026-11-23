import type { Label, Priority, Project, ProjectColor, Recurrence, Task } from '../types/task';
import { PROJECT_COLOR_IDS } from '../types/task';
import { defaultViewOptions, type Settings, type ThemePreference, type ViewOptions } from '../types/settings';
import { findLabelByName, normalizeLabelName } from '../lib/labelSearch';
import { reorderPlan, type Ordered } from '../lib/reorder';
import { todayStr } from '../lib/dates';
import { isSample, sampleLabels, sampleProjects, sampleTasks } from '../lib/sampleData';
import { setSyncKey } from './identity';
import { repository } from './index';
import { SCHEMA_VERSION } from './keys';
import {
  addTaskLabels,
  completeTask,
  editLabel,
  editProject,
  editTask,
  emptyTaskDraft,
  newLabel,
  newProject,
  newTask,
  nextOrder,
  refileTask,
  removeTaskLabel,
  reopenTask,
  rescheduleTask,
  setTaskOrder,
  setTaskRecurrence,
  swapLabelOrder,
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

const colorFor = (count: number): ProjectColor =>
  PROJECT_COLOR_IDS[count % PROJECT_COLOR_IDS.length] ?? 'steel';

// ── Tasks ──────────────────────────────────────────────────────────────────

/** What a new task inherits from where it was added. */
export interface AddContext {
  dueDate: string | null;
  projectId: string | null;
  parentId: string | null;
  labelIds: string[];
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
    labelIds: context.labelIds,
  };
  return repository.saveTask(newTask(draft, nextOrder(tasks), Date.now()));
}

export function updateTask(task: Task, changes: Partial<TaskDraft>): Promise<void> {
  return repository.saveTask(editTask(task, changes, Date.now()));
}

export function setTaskPriority(task: Task, priority: Priority | null): Promise<void> {
  return updateTask(task, { priority });
}

/**
 * Completes or reopens. Returns the document as it was before, so a completion
 * that moved a repeating task on can be undone exactly.
 */
export async function setTaskDone(task: Task, done: boolean): Promise<Task> {
  const now = Date.now();
  await repository.saveTask(done ? completeTask(task, now, todayStr()) : reopenTask(task, now));
  return task;
}

/**
 * Puts a task back the way it was — the undo for a repeating completion. The
 * old content goes back with a *higher* version than the write it undoes, so
 * every device takes it as the newer one.
 */
export function restoreTask(before: Task, current: Task): Promise<void> {
  return repository.saveTask({ ...before, version: current.version + 1, updatedAt: Date.now() });
}

export function rescheduleTo(task: Task, date: string): Promise<void> {
  return repository.saveTask(rescheduleTask(task, date, Date.now()));
}

export function setRecurrence(task: Task, recurrence: Recurrence | null): Promise<void> {
  return repository.saveTask(setTaskRecurrence(task, recurrence, todayStr(), Date.now()));
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

/** A manual move, as shown on screen: `shown` is the list in display order. */
export async function moveTask(
  shown: readonly Ordered[],
  id: string,
  toIndex: number,
  reverse: boolean,
  tasks: readonly Task[],
): Promise<void> {
  const now = Date.now();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const changed = reorderPlan(shown, id, toIndex, reverse).flatMap(({ id: changedId, order }) => {
    const task = byId.get(changedId);
    return task && task.order !== order ? [setTaskOrder(task, order, now)] : [];
  });
  await saveAll(changed);
}

// ── Labels ─────────────────────────────────────────────────────────────────

/**
 * Puts labels on a task by name, making any that don't exist yet.
 *
 * The whole list is resolved before anything is written: two new names sharing
 * one write would otherwise both claim the same order, and the task would be
 * saved twice from the same stale copy, keeping only the last.
 */
export async function addLabelsByName(
  task: Task,
  names: readonly string[],
  labels: readonly Label[],
): Promise<void> {
  const now = Date.now();
  const created: Label[] = [];
  const ids: string[] = [];
  let order = nextOrder(labels);
  for (const raw of names) {
    const name = normalizeLabelName(raw);
    if (!name) continue;
    const existing = findLabelByName([...labels, ...created], name);
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const label = newLabel(name, colorFor(labels.length + created.length), order++, now);
    created.push(label);
    ids.push(label.id);
  }
  await Promise.all(created.map((label) => repository.saveLabel(label)));
  const next = addTaskLabels(task, ids, now);
  if (next !== task) await repository.saveTask(next);
}

export async function addLabelById(task: Task, labelId: string): Promise<void> {
  const next = addTaskLabels(task, [labelId], Date.now());
  if (next !== task) await repository.saveTask(next);
}

export async function removeLabel(task: Task, labelId: string): Promise<void> {
  const next = removeTaskLabel(task, labelId, Date.now());
  if (next !== task) await repository.saveTask(next);
}

export async function createLabel(name: string, labels: readonly Label[]): Promise<string | null> {
  const clean = normalizeLabelName(name);
  if (!clean) return null;
  const existing = findLabelByName([...labels], clean);
  if (existing) return existing.id;
  const label = newLabel(clean, colorFor(labels.length), nextOrder(labels), Date.now());
  await repository.saveLabel(label);
  return label.id;
}

export function updateLabel(
  label: Label,
  changes: Partial<Pick<Label, 'name' | 'colorId'>>,
): Promise<void> {
  return repository.saveLabel(editLabel(label, changes, Date.now()));
}

export async function swapLabels(a: Label, b: Label): Promise<void> {
  await Promise.all(swapLabelOrder(a, b, Date.now()).map((label) => repository.saveLabel(label)));
}

/** Deleting a label takes it off every task that wears it, then removes it. */
export async function deleteLabel(label: Label, tasks: readonly Task[]): Promise<void> {
  const now = Date.now();
  await saveAll(
    tasks.filter((task) => task.labelIds.includes(label.id)).map((task) => removeTaskLabel(task, label.id, now)),
  );
  await repository.deleteLabel(label.id);
}

// ── Projects ───────────────────────────────────────────────────────────────

/** Creates a project and returns its id, so the caller can go straight to it. */
export async function addProject(
  draft: Omit<ProjectDraft, 'colorId'> & Partial<Pick<ProjectDraft, 'colorId'>>,
  projects: readonly Project[],
): Promise<string> {
  const colorId = draft.colorId ?? colorFor(projects.length);
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

// ── Settings ───────────────────────────────────────────────────────────────

function emptySettings(): Settings {
  return { theme: 'system', views: {}, schemaVersion: SCHEMA_VERSION, version: 0, updatedAt: 0 };
}

/** Stores how one view sorts and groups. Writes the settings document whole. */
export function setViewOptions(
  settings: Settings | null,
  viewKey: string,
  changes: Partial<ViewOptions>,
): Promise<void> {
  const base = settings ?? emptySettings();
  const current = base.views[viewKey] ?? defaultViewOptions();
  return repository.saveSettings({
    ...base,
    views: { ...base.views, [viewKey]: { ...current, ...changes } },
    version: base.version + 1,
    updatedAt: Date.now(),
  });
}

export function setThemePreference(settings: Settings | null, theme: ThemePreference): Promise<void> {
  const base = settings ?? emptySettings();
  return repository.saveSettings({ ...base, theme, version: base.version + 1, updatedAt: Date.now() });
}

/**
 * Marks this install as set up, by writing the settings document if it has
 * never been written. That document is the first-run marker: once it exists,
 * sample tasks are never added on their own again — clearing them is final.
 */
export async function markInitialised(settings: Settings | null): Promise<void> {
  if (settings !== null) return;
  await repository.saveSettings({ ...emptySettings(), version: 1, updatedAt: Date.now() });
}

// ── Sample tasks ───────────────────────────────────────────────────────────

export async function loadSamples(): Promise<void> {
  const now = Date.now();
  const today = todayStr();
  await Promise.all([
    ...sampleProjects(now).map((p) => repository.saveProject(p)),
    ...sampleLabels(now).map((l) => repository.saveLabel(l)),
  ]);
  await saveAll(sampleTasks(today, now));
}

/** Removes exactly the documents whose ids say they're samples — nothing you made. */
export async function clearSamples(
  tasks: readonly Task[],
  projects: readonly Project[],
  labels: readonly Label[],
): Promise<void> {
  const now = Date.now();
  // Real tasks wearing a sample label, or filed under a sample project, keep
  // themselves and lose only the sample reference.
  const touched = tasks
    .filter((t) => !isSample(t.id))
    .flatMap((t) => {
      let next = t;
      for (const id of t.labelIds.filter(isSample)) next = removeTaskLabel(next, id, now);
      if (next.projectId && isSample(next.projectId)) next = editTask(next, { projectId: null }, now);
      return next === t ? [] : [next];
    });
  await saveAll(touched);
  await Promise.all([
    ...tasks.filter((t) => isSample(t.id)).map((t) => repository.deleteTask(t.id)),
    ...projects.filter((p) => isSample(p.id)).map((p) => repository.deleteProject(p.id)),
    ...labels.filter((l) => isSample(l.id)).map((l) => repository.deleteLabel(l.id)),
  ]);
}

// ── Sync ───────────────────────────────────────────────────────────────────

/**
 * Connects this device to a sync key. This device's own data goes up first —
 * guarded, so a fresh device joining an existing key can never wipe what's
 * there — and only once it has reached the cloud is the key saved and the app
 * restarted on the cloud store.
 */
export async function connectSync(key: string): Promise<void> {
  const [{ createFirestoreRepository }, { migrateLocalToCloud }] = await Promise.all([
    import('./firestoreRepository'),
    import('./migrate'),
  ]);
  const cloud = createFirestoreRepository(key);
  await migrateLocalToCloud(cloud);
  await cloud.settle();
  setSyncKey(key);
  window.location.reload();
}

/**
 * Back to this device only. The cloud keeps everything; this device returns to
 * the local copy it had before connecting.
 */
export function disconnectSync(): void {
  setSyncKey('');
  window.location.reload();
}
