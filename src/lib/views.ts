import type { Project, Task } from '../types/task';
import { MONTH_NAMES, addDays, shortDate, todayStr, weekdayOf, dayOf } from './dates';

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
  | { kind: 'project'; projectId: string }
  /** One label's tasks, gathered from wherever they're filed. */
  | { kind: 'label'; labelId: string }
  /** Every label, to rename and reorder. Not a task list. */
  | { kind: 'labels' };

export function selectionKey(selection: Selection): string {
  if (selection.kind === 'project') return `project:${selection.projectId}`;
  if (selection.kind === 'label') return `label:${selection.labelId}`;
  return selection.kind;
}

/** Does this task carry that label? Tolerates tasks written before labels. */
export function hasLabel(task: Task, labelId: string): boolean {
  return (task.labelIds ?? []).includes(labelId);
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

/**
 * The same date on a row, where it shares a line with everything else:
 * "Wed 23 Sep", or a word for the two days that have one. A section heading
 * has room to spell Wednesday out — see `dateLabel` — and a row does not.
 */
export function shortDateLabel(date: string, today: string = todayStr()): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return shortDate(date);
}

/**
 * The first line worth showing of a note.
 *
 * A row can hold one line, and the first non-empty one is what a note opens
 * with — which is where anyone puts the part they'd want reminding of. The
 * rest stays in the panel. Blank and whitespace-only notes come back as null,
 * so the row shows nothing rather than an empty space that looks like a bug.
 */
export function noteLine(notes: string | null): string | null {
  if (notes === null) return null;
  return (
    notes
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? null
  );
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

    // Both render their own screen rather than a task list.
    case 'path':
    case 'labels':
      return { sections: [], completed: [] };

    /*
     * A label cuts across projects, so this list is the one place tasks from
     * anywhere sit together. Subtasks are included on their own merits rather
     * than only under a labelled parent — a label is put on a specific task,
     * and hiding one because its parent isn't labelled would lose it.
     */
    case 'label': {
      const labelled = tasks.filter((t) => active(t) && hasLabel(t, selection.labelId));
      return {
        sections: [
          {
            key: selection.labelId,
            title: null,
            items: labelled.sort(byImportance).map((task) => ({ task, subtasks: [] })),
          },
        ],
        completed: tasks
          .filter((t) => !t.archived && t.completedAt !== null && hasLabel(t, selection.labelId))
          .sort(byCompletion),
      };
    }

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
    // No badge: a count here would only repeat what Today already says, and
    // the labels screen is a place to manage rather than a pile to clear.
    case 'path':
    case 'labels':
      return 0;
    case 'project':
      return tasks.filter((t) => active(t) && t.projectId === selection.projectId).length;
    case 'label':
      return tasks.filter((t) => active(t) && hasLabel(t, selection.labelId)).length;
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
