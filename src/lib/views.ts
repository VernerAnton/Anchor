import type { Label, Priority, Project, ProjectColor, Recurrence, Task } from '../types/task';
import { defaultViewOptions, type GroupBy, type SortBy, type ViewOptions } from '../types/settings';
import { addDays } from './dates';
import { dateOfInstant, headingDateLabel, rowDateLabel } from './dateLabels';
import { groupItems } from './grouping';
import { projectOptions, projectScope, toRef, type ProjectOption, type ProjectRef } from './projects';
import { describePreview, describeRecurrence, shortRecurrence } from './recurrence';
import { rescheduleOptions } from './reschedule';
import type { ListSelection } from './selection';
import { byNewestCompletion, bySmart, compareTasks } from './sorting';
import { completeTask } from '../store/mutations';

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

export interface LabelRef {
  id: string;
  name: string;
  colorId: ProjectColor;
}

/** Everything a row shows, already decided — including what to leave off. */
export interface TaskRowModel {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority | null;
  /** `null` when there's none, or when the list or heading is already that project. */
  project: ProjectRef | null;
  /** In the label list's order; leaves off the label the list is about. */
  labels: LabelRef[];
  /** `null` when there's none, or when the section heading already says it. */
  due: DueModel | null;
  /** How often, briefly — "Mon–Fri", "every 2 weeks". Mechanism stays in the panel. */
  recurrence: string | null;
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

/** How the list is arranged, and which choices it offers. */
export interface ListOptionsModel {
  sortBy: SortBy;
  reverse: boolean;
  groupBy: GroupBy;
  /** Grouping is offered only where the list isn't already cut along that axis. */
  groupable: boolean;
  /** Manual order: rows can be moved by hand. */
  manual: boolean;
}

export interface ListModel {
  title: string;
  sections: SectionModel[];
  /** Done tasks belonging to this view, newest first. */
  completed: TaskRowModel[];
  /** What to say when nothing is open. Never a judgement. */
  emptyText: string;
  quickAdd: QuickAddModel;
  options: ListOptionsModel;
}

/** Where a task added from this list lands — and the words that say so. */
export interface QuickAddModel {
  placeholder: string;
  dueDate: string | null;
  projectId: string | null;
  labelIds: string[];
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
  labels: Map<string, Label>;
}

/** What the surrounding list already says, so the row needn't repeat it. */
interface Context {
  /** The project the list or heading is about. */
  projectId: string | null;
  /** The label the list or heading is about. */
  labelId: string | null;
  /** The date the heading states. */
  date: string | null;
}

const NO_CONTEXT: Context = { projectId: null, labelId: null, date: null };

const toLabelRef = (label: Label): LabelRef => ({ id: label.id, name: label.name, colorId: label.colorId });

function wornLabels(task: Task, lookup: Lookup, except: string | null): LabelRef[] {
  return task.labelIds
    .flatMap((id) => {
      const label = lookup.labels.get(id);
      return label && !label.archived && label.id !== except ? [label] : [];
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(toLabelRef);
}

function toRow(
  task: Task,
  ctx: Context,
  lookup: Lookup,
  nested: boolean,
  subtasks: TaskRowModel[] = [],
): TaskRowModel {
  const project = task.projectId ? lookup.projects.get(task.projectId) : undefined;
  const parent = task.parentId ? lookup.tasks.get(task.parentId) : undefined;
  const open = task.completedAt === null;
  return {
    id: task.id,
    title: task.title,
    status: taskStatus(task),
    priority: task.priority,
    // A nested subtask's parent row already carries the project.
    project: project && !nested && project.id !== ctx.projectId ? toRef(project) : null,
    labels: wornLabels(task, lookup, ctx.labelId),
    due:
      task.dueDate !== null && task.dueDate !== ctx.date
        ? { label: rowDateLabel(task.dueDate, lookup.today), past: open && task.dueDate < lookup.today }
        : null,
    recurrence: open && task.recurrence ? shortRecurrence(task.recurrence) : null,
    note: noteLine(task.notes),
    parentTitle: parent && !nested ? parent.title : null,
    subtasks,
  };
}

/** A top-level row and the subtasks nested under it. */
interface Item {
  task: Task;
  subtasks: Task[];
}

/**
 * Items from the tasks that qualify for a section. A subtask sits under its
 * parent when the parent qualifies too, and stands on its own — saying whose
 * it is — when it doesn't. Nothing is shown twice and nothing is lost because
 * its parent lives elsewhere.
 */
function itemsOf(qualifying: readonly Task[]): Item[] {
  const ids = new Set(qualifying.map((task) => task.id));
  return qualifying
    .filter((task) => task.parentId === null || !ids.has(task.parentId))
    .map((task) => ({
      task,
      subtasks: task.parentId === null ? qualifying.filter((sub) => sub.parentId === task.id) : [],
    }));
}

/** One section-to-be: its items, and what its heading already says. */
interface Cut {
  key: string;
  title: string | null;
  items: Item[];
  ctx: Context;
  /** Whether grouping may re-cut this section. Today's Earlier never is. */
  groupable: boolean;
}

function cut(key: string, title: string | null, tasks: readonly Task[], ctx: Context, groupable: boolean): Cut {
  return { key, title, items: itemsOf(tasks), ctx, groupable };
}

/**
 * Grouping happens before sorting — sorting a list about to be cut up is work
 * thrown away; the order that matters is the one read down a section.
 */
function render(cuts: Cut[], input: ViewInput, lookup: Lookup, groupBy: GroupBy, compare: (a: Task, b: Task) => number) {
  const expanded = cuts.flatMap((c): Cut[] =>
    c.groupable && groupBy !== 'none'
      ? groupItems(c.items, groupBy, input.projects, input.labels).map((g) => ({
          key: `${c.key}:${g.key}`,
          title: g.title,
          items: g.items,
          ctx: { ...c.ctx, projectId: g.projectId ?? c.ctx.projectId, labelId: g.labelId ?? c.ctx.labelId },
          groupable: false,
        }))
      : [c],
  );
  return expanded
    .map((c) => ({
      key: c.key,
      title: c.title,
      rows: [...c.items]
        .sort((a, b) => compare(a.task, b.task))
        .map((item) =>
          toRow(
            item.task,
            c.ctx,
            lookup,
            false,
            [...item.subtasks].sort(compare).map((sub) => toRow(sub, c.ctx, lookup, true)),
          ),
        ),
    }))
    .filter((section) => section.rows.length > 0);
}

function completedRows(done: readonly Task[], ctx: Context, lookup: Lookup) {
  return [...done].sort(byNewestCompletion).map((task) => toRow(task, ctx, lookup, false));
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
  selection: ListSelection;
  tasks: readonly Task[];
  projects: readonly Project[];
  labels: readonly Label[];
  today: string;
  /** This view's sort and grouping. Absent means the defaults. */
  options?: ViewOptions;
}

function lookupOf({ tasks, projects, labels, today }: Omit<ViewInput, 'selection'>): Lookup {
  return {
    today,
    tasks: new Map(tasks.map((t) => [t.id, t])),
    projects: new Map(projects.map((p) => [p.id, p])),
    labels: new Map(labels.map((l) => [l.id, l])),
  };
}

interface ViewShape {
  title: string;
  cuts: Cut[];
  completed: TaskRowModel[];
  emptyText: string;
  quickAdd: QuickAddModel;
}

function shapeOf(input: ViewInput, lookup: Lookup): ViewShape {
  const { selection, tasks, projects, today } = input;
  const open = tasks.filter(isOpen);
  const done = tasks.filter(isDone);

  switch (selection.kind) {
    case 'today': {
      const due = open.filter((t) => {
        const date = effectiveDate(t, lookup);
        return date !== null && date <= today;
      });
      // "Earlier": dates that have gone by. A fact about the calendar, not a
      // verdict — never "overdue", never counted against anyone. It stays on
      // top, ungrouped, whatever grouping is chosen.
      return {
        title: 'Today',
        cuts: [
          cut('earlier', 'Earlier', due.filter((t) => effectiveDate(t, lookup)! < today), NO_CONTEXT, false),
          cut('today', 'Today', due.filter((t) => effectiveDate(t, lookup) === today), { ...NO_CONTEXT, date: today }, true),
        ],
        completed: completedRows(
          done.filter((t) => dateOfInstant(t.completedAt!) === today),
          NO_CONTEXT,
          lookup,
        ),
        emptyText: 'Nothing is due today.',
        quickAdd: { placeholder: 'Add a task for today', dueDate: today, projectId: null, labelIds: [] },
      };
    }

    case 'upcoming': {
      const ahead = open.filter((t) => {
        const date = effectiveDate(t, lookup);
        return date !== null && date > today;
      });
      const dates = [...new Set(ahead.map((t) => effectiveDate(t, lookup)!))].sort();
      return {
        title: 'Upcoming',
        cuts: dates.map((date) =>
          cut(
            date,
            headingDateLabel(date, today),
            ahead.filter((t) => effectiveDate(t, lookup) === date),
            { ...NO_CONTEXT, date },
            false,
          ),
        ),
        completed: completedRows(
          done.filter((t) => {
            const date = effectiveDate(t, lookup);
            return date !== null && date > today;
          }),
          NO_CONTEXT,
          lookup,
        ),
        emptyText: 'Nothing is scheduled after today.',
        quickAdd: {
          placeholder: 'Add a task for tomorrow',
          dueDate: addDays(today, 1),
          projectId: null,
          labelIds: [],
        },
      };
    }

    case 'all':
      return {
        title: 'All tasks',
        cuts: [cut('all', null, open, NO_CONTEXT, true)],
        completed: completedRows(done, NO_CONTEXT, lookup),
        emptyText: 'Nothing here yet. Anything you add will appear in this list.',
        quickAdd: { placeholder: 'Add a task', dueDate: null, projectId: null, labelIds: [] },
      };

    case 'project': {
      const name = lookup.projects.get(selection.projectId)?.name ?? 'Project';
      // A project's list includes its sub-projects', each under its own heading.
      const scope = projectScope(selection.projectId, projects).filter((id) => {
        const p = lookup.projects.get(id);
        return id === selection.projectId || (p !== undefined && !p.archived);
      });
      return {
        title: name,
        cuts: scope.map((id) =>
          cut(
            id,
            id === selection.projectId ? null : (lookup.projects.get(id)?.name ?? null),
            open.filter((t) => t.projectId === id),
            { ...NO_CONTEXT, projectId: id },
            false,
          ),
        ),
        completed: completedRows(
          done.filter((t) => t.projectId !== null && scope.includes(t.projectId)),
          { ...NO_CONTEXT, projectId: selection.projectId },
          lookup,
        ),
        emptyText: `Nothing filed under ${name} yet.`,
        quickAdd: {
          placeholder: `Add a task to ${name}`,
          dueDate: null,
          projectId: selection.projectId,
          labelIds: [],
        },
      };
    }

    case 'label': {
      // A label cuts across projects: this list is the one place tasks from
      // anywhere sit together. Subtasks count on their own merits.
      const name = lookup.labels.get(selection.labelId)?.name ?? 'Label';
      const ctx = { ...NO_CONTEXT, labelId: selection.labelId };
      const has = (t: Task) => t.labelIds.includes(selection.labelId);
      return {
        title: name,
        cuts: [cut(selection.labelId, null, open.filter(has), ctx, false)],
        completed: completedRows(done.filter(has), ctx, lookup),
        emptyText: `Nothing is labelled ${name} yet.`,
        quickAdd: {
          placeholder: `Add a task labelled ${name}`,
          dueDate: null,
          projectId: null,
          labelIds: [selection.labelId],
        },
      };
    }
  }
}

export function buildList(input: ViewInput): ListModel {
  const lookup = lookupOf(input);
  const options = input.options ?? defaultViewOptions();
  const groupable = input.selection.kind === 'today' || input.selection.kind === 'all';
  const groupBy = groupable ? options.groupBy : 'none';
  const shape = shapeOf(input, lookup);
  return {
    title: shape.title,
    sections: render(shape.cuts, input, lookup, groupBy, compareTasks(options.sortBy, options.reverse)),
    completed: shape.completed,
    emptyText: shape.emptyText,
    quickAdd: shape.quickAdd,
    options: {
      sortBy: options.sortBy,
      reverse: options.reverse,
      groupBy,
      groupable,
      manual: options.sortBy === 'manual',
    },
  };
}

/** How many open tasks a view holds, for the sidebar. Grouping never counts a task twice. */
export function countFor(input: ViewInput): number {
  const list = buildList({ ...input, options: defaultViewOptions() });
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

export interface RescheduleChoice {
  id: string;
  label: string;
  /** Where it lands, ready to read — the button says this before you press it. */
  dateLabel: string;
  date: string;
  /** Already the due date: marked, never disabled, so a press still has feedback. */
  current: boolean;
}

export interface TaskDetailModel {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  /** "Completed Wed 23 Sep", or nothing while it's open. */
  completedLabel: string | null;
  dueDate: string | null;
  /** Empty once the task is done — nothing should start moving a finished task. */
  reschedule: RescheduleChoice[];
  priority: Priority | null;
  projectId: string | null;
  /** A subtask's project is its parent's; this says which, since it can't be chosen. */
  projectName: string | null;
  projectOptions: ProjectOption[];
  labels: LabelRef[];
  recurrence: Recurrence | null;
  /** Where a new rule takes its phase from: the due date, or today. */
  recurrenceFrom: string;
  /** The rule read back as a sentence, and the next dates it will produce. */
  recurrenceSummary: string | null;
  recurrencePreview: string | null;
  /** Set for a subtask: the task it belongs to. */
  parent: { id: string; title: string } | null;
  /** `null` for a subtask — one level only, so a subtask can't have its own. */
  subtasks: TaskRowModel[] | null;
}

export function taskDetail(input: Omit<ViewInput, 'selection'>, id: string | null): TaskDetailModel | null {
  if (id === null) return null;
  const lookup = lookupOf(input);
  const task = lookup.tasks.get(id);
  if (!task) return null;
  const parent = task.parentId ? lookup.tasks.get(task.parentId) : undefined;
  const project = task.projectId ? lookup.projects.get(task.projectId) : undefined;
  const children = input.tasks.filter((t) => t.parentId === task.id && live(t));
  const open = task.completedAt === null;
  const from = task.dueDate ?? input.today;

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
    reschedule: open
      ? rescheduleOptions(task, input.today).map((option) => ({
          ...option,
          current: option.date === task.dueDate,
        }))
      : [],
    priority: task.priority,
    projectId: task.projectId,
    projectName: project?.name ?? null,
    projectOptions: projectOptions(input.projects, task.projectId),
    labels: wornLabels(task, lookup, null),
    recurrence: task.recurrence,
    recurrenceFrom: from,
    recurrenceSummary: task.recurrence ? describeRecurrence(task.recurrence) : null,
    recurrencePreview: task.recurrence ? describePreview(task.recurrence, from, 4) : null,
    parent: parent ? { id: parent.id, title: parent.title } : null,
    subtasks: task.parentId
      ? null
      : [
          ...children.filter((t) => t.completedAt === null).sort(bySmart),
          ...children.filter((t) => t.completedAt !== null).sort(byNewestCompletion),
        ].map((sub) => toRow(sub, NO_CONTEXT, lookup, true)),
  };
}

// ── The labels screen ──────────────────────────────────────────────────────

export interface LabelsScreenRow extends LabelRef {
  /** Open tasks wearing it. */
  count: number;
  /** The neighbours a move would swap with; `null` at either end. */
  above: string | null;
  below: string | null;
}

export function labelsScreen(labels: readonly Label[], tasks: readonly Task[]): LabelsScreenRow[] {
  const ordered = labels
    .filter((label) => !label.archived)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return ordered.map((label, i) => ({
    ...toLabelRef(label),
    count: tasks.filter((t) => isOpen(t) && t.labelIds.includes(label.id)).length,
    above: ordered[i - 1]?.id ?? null,
    below: ordered[i + 1]?.id ?? null,
  }));
}

// ── Feedback ───────────────────────────────────────────────────────────────

/**
 * What to say when completing a task moved it on rather than closing it — a
 * repeating task's checkbox unticks itself, and without a word that looks
 * like the press did nothing.
 */
export function completionNotice(task: Task, today: string): string | null {
  if (task.completedAt !== null) return null;
  const next = completeTask(task, 0, today);
  if (next.completedAt !== null || next.dueDate === null) return null;
  return `“${task.title}” is next due ${rowDateLabel(next.dueDate, today)}.`;
}
