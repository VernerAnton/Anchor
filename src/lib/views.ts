import type { Priority, Project, Task } from '../types/task';
import { addDays } from './dates';
import { dateOfInstant, headingDateLabel, rowDateLabel } from './dateLabels';
import { projectOptions, projectScope, toRef, type ProjectOption, type ProjectRef } from './projects';
import type { Selection } from './selection';
import { byNewestCompletion, bySmart } from './sorting';

/**
 * What each view shows, as data. Pure functions: tasks in, sections and rows
 * out.
 *
 * Components never work out whether a task is done, which section it belongs
 * to, or whether its date is worth printing — they receive the answer and
 * render it. That is the rule that lets two wildly different themes share
 * every line of logic.
 */

export type TaskStatus = 'open' | 'done';

export interface DueModel {
  label: string;
  /**
   * The date has gone by. Exists so a theme *can* mark it — the default one
   * keeps it neutral, and no theme may make it read as a failure.
   */
  past: boolean;
}

/** Everything a row shows, already decided — including what to leave off. */
export interface TaskRowModel {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority | null;
  /** `null` when there's none, or when the list is already that project's. */
  project: ProjectRef | null;
  /** `null` when there's none, or when the section heading already says it. */
  due: DueModel | null;
  /** The note's first line — what it says, not a marker that it exists. */
  note: string | null;
  /** For a subtask shown on its own, away from its parent. */
  parentTitle: string | null;
  /** Subtasks nested under this row. Always empty on a subtask. */
  subtasks: TaskRowModel[];
}

export interface SectionModel {
  key: string;
  /** `null` for a list that needs no heading. */
  title: string | null;
  rows: TaskRowModel[];
}

export interface ListModel {
  title: string;
  sections: SectionModel[];
  /** Done tasks belonging to this view, newest first. */
  completed: TaskRowModel[];
  /** What to say when nothing is open. Never a judgement. */
  emptyText: string;
  quickAdd: QuickAddModel;
}

/** Where a task added from this list lands — and the words that say so. */
export interface QuickAddModel {
  placeholder: string;
  dueDate: string | null;
  projectId: string | null;
}

export function taskStatus(task: Task): TaskStatus {
  return task.completedAt === null ? 'open' : 'done';
}

/** The first non-blank line of a note; blank notes come back as nothing. */
export function noteLine(notes: string | null): string | null {
  if (notes === null) return null;
  return (
    notes
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? null
  );
}

// ── Building rows ──────────────────────────────────────────────────────────

interface Lookup {
  today: string;
  tasks: Map<string, Task>;
  projects: Map<string, Project>;
}

/** What the surrounding list already says, so the row needn't repeat it. */
interface RowContext {
  /** The project the list or section is about. */
  projectId: string | null;
  /** The date the section heading states. */
  date: string | null;
  /** Nested under its parent's row, which carries the project. */
  nested: boolean;
}

function toRow(task: Task, ctx: RowContext, lookup: Lookup, subtasks: TaskRowModel[] = []): TaskRowModel {
  const project = task.projectId ? lookup.projects.get(task.projectId) : undefined;
  const parent = task.parentId ? lookup.tasks.get(task.parentId) : undefined;
  const open = task.completedAt === null;
  return {
    id: task.id,
    title: task.title,
    status: taskStatus(task),
    priority: task.priority,
    project: project && !ctx.nested && project.id !== ctx.projectId ? toRef(project) : null,
    due:
      task.dueDate !== null && task.dueDate !== ctx.date
        ? { label: rowDateLabel(task.dueDate, lookup.today), past: open && task.dueDate < lookup.today }
        : null,
    note: noteLine(task.notes),
    parentTitle: parent && !ctx.nested ? parent.title : null,
    subtasks,
  };
}

/**
 * Rows for one section, from the tasks that qualify for it.
 *
 * A subtask sits under its parent when the parent is in the same section, and
 * stands on its own — saying whose it is — when it isn't. Nothing is shown
 * twice and nothing is lost because its parent lives elsewhere.
 */
function sectionRows(
  qualifying: readonly Task[],
  ctx: Omit<RowContext, 'nested'>,
  lookup: Lookup,
): TaskRowModel[] {
  const ids = new Set(qualifying.map((task) => task.id));
  return qualifying
    .filter((task) => task.parentId === null || !ids.has(task.parentId))
    .sort(bySmart)
    .map((task) => {
      const subtasks =
        task.parentId === null
          ? qualifying
              .filter((sub) => sub.parentId === task.id)
              .sort(bySmart)
              .map((sub) => toRow(sub, { ...ctx, nested: true }, lookup))
          : [];
      return toRow(task, { ...ctx, nested: false }, lookup, subtasks);
    });
}

function completedRows(done: readonly Task[], ctx: Omit<RowContext, 'nested'>, lookup: Lookup) {
  return [...done].sort(byNewestCompletion).map((task) => toRow(task, { ...ctx, nested: false }, lookup));
}

/**
 * The date a task lives on for Today and Upcoming. A subtask with no date of
 * its own follows its parent's, so breaking a dated task down doesn't strand
 * its pieces in the backlog.
 */
function effectiveDate(task: Task, lookup: Lookup): string | null {
  if (task.dueDate !== null) return task.dueDate;
  const parent = task.parentId ? lookup.tasks.get(task.parentId) : undefined;
  return parent?.dueDate ?? null;
}

const live = (task: Task) => !task.archived;
const isOpen = (task: Task) => live(task) && task.completedAt === null;
const isDone = (task: Task) => live(task) && task.completedAt !== null;

// ── Views ──────────────────────────────────────────────────────────────────

export interface ViewInput {
  selection: Selection;
  tasks: readonly Task[];
  projects: readonly Project[];
  today: string;
}

function lookupOf({ tasks, projects, today }: ViewInput): Lookup {
  return {
    today,
    tasks: new Map(tasks.map((t) => [t.id, t])),
    projects: new Map(projects.map((p) => [p.id, p])),
  };
}

export function buildList(input: ViewInput): ListModel {
  const { selection, tasks, projects, today } = input;
  const lookup = lookupOf(input);
  const open = tasks.filter(isOpen);
  const done = tasks.filter(isDone);
  const noContext = { projectId: null, date: null };

  switch (selection.kind) {
    case 'today': {
      const due = open.filter((t) => {
        const date = effectiveDate(t, lookup);
        return date !== null && date <= today;
      });
      // "Earlier": dates that have gone by. A fact about the calendar, not a
      // verdict — never "overdue", never counted against anyone.
      const earlier = due.filter((t) => effectiveDate(t, lookup)! < today);
      const now = due.filter((t) => effectiveDate(t, lookup) === today);
      return {
        title: 'Today',
        sections: [
          { key: 'earlier', title: 'Earlier', rows: sectionRows(earlier, noContext, lookup) },
          { key: 'today', title: 'Today', rows: sectionRows(now, { projectId: null, date: today }, lookup) },
        ].filter((section) => section.rows.length > 0),
        completed: completedRows(
          done.filter((t) => dateOfInstant(t.completedAt!) === today),
          noContext,
          lookup,
        ),
        emptyText: 'Nothing is due today.',
        quickAdd: { placeholder: 'Add a task for today', dueDate: today, projectId: null },
      };
    }

    case 'upcoming': {
      const ahead = open.filter((t) => {
        const date = effectiveDate(t, lookup);
        return date !== null && date > today;
      });
      const dates = [...new Set(ahead.map((t) => effectiveDate(t, lookup)!))].sort();
      const tomorrow = addDays(today, 1);
      return {
        title: 'Upcoming',
        sections: dates.map((date) => ({
          key: date,
          title: headingDateLabel(date, today),
          rows: sectionRows(
            ahead.filter((t) => effectiveDate(t, lookup) === date),
            { projectId: null, date },
            lookup,
          ),
        })),
        completed: completedRows(
          done.filter((t) => {
            const date = effectiveDate(t, lookup);
            return date !== null && date > today;
          }),
          noContext,
          lookup,
        ),
        emptyText: 'Nothing is scheduled after today.',
        quickAdd: { placeholder: 'Add a task for tomorrow', dueDate: tomorrow, projectId: null },
      };
    }

    case 'all':
      return {
        title: 'All tasks',
        sections: [{ key: 'all', title: null, rows: sectionRows(open, noContext, lookup) }].filter(
          (section) => section.rows.length > 0,
        ),
        completed: completedRows(done, noContext, lookup),
        emptyText: 'Nothing here yet. Anything you add will appear in this list.',
        quickAdd: { placeholder: 'Add a task', dueDate: null, projectId: null },
      };

    case 'project': {
      const project = lookup.projects.get(selection.projectId);
      const name = project?.name ?? 'Project';
      // A project's list includes its sub-projects', each under its own heading.
      const scope = projectScope(selection.projectId, projects).filter((id) => {
        const p = lookup.projects.get(id);
        return id === selection.projectId || (p !== undefined && !p.archived);
      });
      const sections = scope.map((id) => ({
        key: id,
        title: id === selection.projectId ? null : (lookup.projects.get(id)?.name ?? null),
        rows: sectionRows(
          open.filter((t) => t.projectId === id),
          { projectId: id, date: null },
          lookup,
        ),
      }));
      return {
        title: name,
        sections: sections.filter((section) => section.rows.length > 0),
        completed: completedRows(
          done.filter((t) => t.projectId !== null && scope.includes(t.projectId)),
          { projectId: selection.projectId, date: null },
          lookup,
        ),
        emptyText: `Nothing filed under ${name} yet.`,
        quickAdd: {
          placeholder: `Add a task to ${name}`,
          dueDate: null,
          projectId: selection.projectId,
        },
      };
    }
  }
}

/** How many open tasks a view holds, for the sidebar. Matches what the list shows. */
export function countFor(input: ViewInput): number {
  const list = buildList(input);
  return list.sections.reduce(
    (sum, section) => sum + section.rows.reduce((n, row) => n + 1 + row.subtasks.length, 0),
    0,
  );
}

/**
 * Where keyboard focus should land after a row's status changes and it moves
 * out from under the cursor. Completing an open row hands focus to the row
 * that takes its place (or the one above, at the end of the list); reopening
 * a done row follows it into the open list.
 */
export function focusAfterToggle(list: ListModel, id: string, done: boolean): string | null {
  if (!done) return id;
  const order = list.sections.flatMap((section) =>
    section.rows.flatMap((row) => [row.id, ...row.subtasks.map((sub) => sub.id)]),
  );
  const index = order.indexOf(id);
  if (index === -1) return id;
  return order[index + 1] ?? order[index - 1] ?? null;
}

// ── The detail panel ───────────────────────────────────────────────────────

export interface TaskDetailModel {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  /** "Completed Wed 23 Sep", or nothing while it's open. */
  completedLabel: string | null;
  dueDate: string | null;
  priority: Priority | null;
  projectId: string | null;
  /** A subtask's project is its parent's; this says which, since it can't be chosen. */
  projectName: string | null;
  projectOptions: ProjectOption[];
  /** Set for a subtask: the task it belongs to. */
  parent: { id: string; title: string } | null;
  /** `null` for a subtask — one level only, so a subtask can't have its own. */
  subtasks: TaskRowModel[] | null;
}

export function taskDetail(
  input: Omit<ViewInput, 'selection'>,
  id: string | null,
): TaskDetailModel | null {
  if (id === null) return null;
  const lookup = lookupOf({ ...input, selection: { kind: 'all' } });
  const task = lookup.tasks.get(id);
  if (!task) return null;
  const parent = task.parentId ? lookup.tasks.get(task.parentId) : undefined;
  const project = task.projectId ? lookup.projects.get(task.projectId) : undefined;
  const children = input.tasks.filter((t) => t.parentId === task.id && live(t));
  const nested: RowContext = { projectId: null, date: null, nested: true };

  return {
    id: task.id,
    title: task.title,
    notes: task.notes ?? '',
    status: taskStatus(task),
    completedLabel:
      task.completedAt === null
        ? null
        : `Completed ${rowDateLabel(dateOfInstant(task.completedAt), input.today)}`,
    dueDate: task.dueDate,
    priority: task.priority,
    projectId: task.projectId,
    projectName: project?.name ?? null,
    projectOptions: projectOptions(input.projects, task.projectId),
    parent: parent ? { id: parent.id, title: parent.title } : null,
    subtasks: task.parentId
      ? null
      : [
          ...children.filter((t) => t.completedAt === null).sort(bySmart),
          ...children.filter((t) => t.completedAt !== null).sort(byNewestCompletion),
        ].map((sub) => toRow(sub, nested, lookup)),
  };
}
