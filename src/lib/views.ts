import type { Project, Task } from '../types/task';
import { MONTH_NAMES, todayStr, weekdayOf, dayOf } from './dates';

/**
 * Everything the views derive from raw data, as pure functions returning data.
 * Components receive the result and render it — status, ordering and grouping
 * are decided here, so two wildly different themes (and later, two wildly
 * different views) share every line of this logic.
 */

export type Selection =
  | { kind: 'today' }
  | { kind: 'upcoming' }
  | { kind: 'all' }
  /** The path overview. Renders its own screen rather than a task list. */
  | { kind: 'path' }
  | { kind: 'project'; projectId: string };

export function selectionKey(selection: Selection): string {
  return selection.kind === 'project' ? `project:${selection.projectId}` : selection.kind;
}

export interface TaskListItem {
  task: Task;
  /** Incomplete subtasks, shown nested under their parent. */
  subtasks: Task[];
}

export interface TaskSection {
  key: string;
  /** `null` for a list that needs no heading. */
  title: string | null;
  items: TaskListItem[];
}

export interface TaskListModel {
  sections: TaskSection[];
  /** Completed tasks relevant to the selection, newest first. */
  completed: Task[];
}

const active = (t: Task) => !t.archived && t.completedAt === null;

/**
 * Priority 1 is the strongest pull. Sorting: priority first (none last), then
 * due date (none last), then the manual order, then title as a stable tiebreak.
 */
function byImportance(a: Task, b: Task): number {
  const pa = a.priority ?? 5;
  const pb = b.priority ?? 5;
  if (pa !== pb) return pa - pb;
  const da = a.dueDate ?? '9999-12-31';
  const db = b.dueDate ?? '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  if (a.order !== b.order) return a.order - b.order;
  return a.title.localeCompare(b.title);
}

function byCompletion(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0);
}

/** Nest incomplete subtasks under the given top-level tasks. */
function withSubtasks(parents: Task[], all: Task[]): TaskListItem[] {
  return parents.map((task) => ({
    task,
    subtasks: all.filter((t) => t.parentId === task.id && active(t)).sort(byImportance),
  }));
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** "Wednesday · 5 Aug" — explicit, no relative phrasing beyond Today/Tomorrow. */
export function dateLabel(date: string, today: string = todayStr()): string {
  if (date === today) return 'Today';
  const month = MONTH_NAMES[Number(date.slice(5, 7)) - 1];
  return `${WEEKDAY_NAMES[weekdayOf(date)]} · ${dayOf(date)} ${month}`;
}

/** Same day, by local calendar, for the "done today" list. */
function completedOn(task: Task, today: string): boolean {
  if (task.completedAt === null) return false;
  return todayStr(new Date(task.completedAt)) === today;
}

export function buildTaskList(
  selection: Selection,
  tasks: Task[],
  today: string = todayStr(),
): TaskListModel {
  switch (selection.kind) {
    case 'today': {
      const due = tasks.filter((t) => active(t) && t.dueDate !== null && t.dueDate <= today);
      // "Earlier" is a date that has gone by, not a verdict. Never blame-framed.
      const earlier = due.filter((t) => t.dueDate! < today).sort(byImportance);
      const dueToday = due.filter((t) => t.dueDate === today).sort(byImportance);
      const sections: TaskSection[] = [];
      if (earlier.length > 0) {
        sections.push({ key: 'earlier', title: 'Earlier', items: withSubtasks(earlier, tasks) });
      }
      sections.push({ key: 'today', title: 'Today', items: withSubtasks(dueToday, tasks) });
      return {
        sections,
        completed: tasks.filter((t) => !t.archived && completedOn(t, today)).sort(byCompletion),
      };
    }

    case 'upcoming': {
      const future = tasks.filter((t) => active(t) && t.dueDate !== null && t.dueDate > today);
      const dates = [...new Set(future.map((t) => t.dueDate!))].sort();
      return {
        sections: dates.map((date) => ({
          key: date,
          title: dateLabel(date, today),
          items: withSubtasks(
            future.filter((t) => t.dueDate === date).sort(byImportance),
            tasks,
          ),
        })),
        completed: [],
      };
    }

    case 'all': {
      const top = tasks.filter((t) => active(t) && t.parentId === null);
      return {
        sections: [{ key: 'all', title: null, items: withSubtasks(top.sort(byImportance), tasks) }],
        completed: tasks
          .filter((t) => !t.archived && t.completedAt !== null)
          .sort(byCompletion),
      };
    }

    // The path renders its own screen from the repeat rules, not a task list.
    case 'path':
      return { sections: [], completed: [] };

    case 'project': {
      const top = tasks.filter(
        (t) => active(t) && t.projectId === selection.projectId && t.parentId === null,
      );
      return {
        sections: [
          { key: selection.projectId, title: null, items: withSubtasks(top.sort(byImportance), tasks) },
        ],
        completed: tasks
          .filter((t) => !t.archived && t.completedAt !== null && t.projectId === selection.projectId)
          .sort(byCompletion),
      };
    }
  }
}

/** Badge count for the sidebar. */
export function countFor(selection: Selection, tasks: Task[], today: string = todayStr()): number {
  switch (selection.kind) {
    case 'today':
      return tasks.filter((t) => active(t) && t.dueDate !== null && t.dueDate <= today).length;
    case 'upcoming':
      return tasks.filter((t) => active(t) && t.dueDate !== null && t.dueDate > today).length;
    case 'all':
      return tasks.filter(active).length;
    // No badge: a count here would only repeat what Today already says.
    case 'path':
      return 0;
    case 'project':
      return tasks.filter((t) => active(t) && t.projectId === selection.projectId).length;
  }
}

export interface ProjectNode {
  project: Project;
  children: Project[];
}

const byOrder = (a: Project, b: Project) =>
  a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name);

/** One level of nesting, matching flat subtasks: enough structure, no rabbit hole. */
export function projectTree(projects: Project[]): ProjectNode[] {
  const live = projects.filter((p) => !p.archived);
  const topLevel = live
    .filter((p) => p.parentId === null || !live.some((q) => q.id === p.parentId))
    .sort(byOrder);
  return topLevel.map((project) => ({
    project,
    children: live.filter((p) => p.parentId === project.id).sort(byOrder),
  }));
}

/** The date a quick-added task should get in this view. */
export function defaultDueDate(selection: Selection, today: string = todayStr()): string | null {
  return selection.kind === 'today' ? today : null;
}

/** The project a quick-added task should get in this view. */
export function defaultProjectId(selection: Selection): string | null {
  return selection.kind === 'project' ? selection.projectId : null;
}
