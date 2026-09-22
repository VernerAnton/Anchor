import type { Project, Task } from '../types/task';
import { addDays, weekStart, weekdayOf } from './dates';
import { matches } from './recurrence';

/**
 * What lands on each day, projected forward — the overview's whole content.
 *
 * A task says how often it appears through its repeat rule. A task with no
 * rule appears once, on its due date. That single sentence is the entire
 * model: the same rule that gives the to-do side its due dates is what puts
 * something on the path, which is why the app can be used purely as a task
 * manager by anyone who never turns path mode on.
 *
 * This is a projection, not a record. It answers "given these rules, what do
 * the coming weeks look like" — nothing here is stored, and looking at a
 * future day never creates anything.
 */

const active = (t: Task) => !t.archived && t.completedAt === null;

/** Does this task land on this date? */
export function landsOn(task: Task, date: string): boolean {
  if (!active(task)) return false;
  return task.recurrence !== null ? matches(task.recurrence, date) : task.dueDate === date;
}

export interface GridDay {
  date: string;
  /** JS convention: 0 = Sunday … 6 = Saturday. */
  weekday: number;
  tasks: Task[];
}

export interface GridWeek {
  /** The Monday this week begins on, and the row's stable key. */
  start: string;
  days: GridDay[];
}

/**
 * `weeks` rows of seven days, starting from the Monday of `from`'s week — so
 * the row containing today is always complete rather than starting mid-week.
 *
 * Ordering within a day is the task's own manual order for now. Times and an
 * explicit within-day order arrive with the day editor; until then this is
 * "what shows up", not "in what sequence".
 */
export function buildGrid(tasks: Task[], from: string, weeks: number): GridWeek[] {
  const live = tasks.filter(active);
  const firstMonday = weekStart(from);

  const grid: GridWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const start = addDays(firstMonday, w * 7);
    const days: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, d);
      days.push({
        date,
        weekday: weekdayOf(date),
        tasks: live.filter((t) => landsOn(t, date)).sort((a, b) => a.order - b.order),
      });
    }
    grid.push({ start, days });
  }
  return grid;
}

export interface LibrarySection {
  key: string;
  title: string;
  /** `null` for the catch-all section holding everything unfiled. */
  project: Project | null;
  tasks: Task[];
}

/**
 * Every live task, grouped into project sections — what the sidebar's project
 * list turns into once path mode hides it.
 *
 * "All tasks" leads, holding everything with no project, so nothing is ever
 * only reachable by knowing which project it went into. Projects follow in
 * their own order. Subtasks stay out: they belong under their parent, not
 * loose in a list you drag from.
 */
export function groupByProject(tasks: Task[], projects: Project[]): LibrarySection[] {
  const live = tasks.filter((t) => active(t) && t.parentId === null);
  const byOrder = (a: Project, b: Project) =>
    a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name);

  return [
    {
      key: 'unfiled',
      title: 'All tasks',
      project: null,
      tasks: live.filter((t) => t.projectId === null),
    },
    ...projects
      .filter((p) => !p.archived)
      .sort(byOrder)
      .map((project) => ({
        key: project.id,
        title: project.name,
        project,
        tasks: live.filter((t) => t.projectId === project.id),
      })),
  ];
}
