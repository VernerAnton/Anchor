import type { Task } from '../types/task';
import type { SortBy } from '../types/settings';

/**
 * How rows are ordered within a section.
 *
 * Absent values sort last, always — an unprioritised task is not a P5 and an
 * undated one is not overdue, but something has to go somewhere, and the end
 * is the position that implies no judgement. Reversing negates the whole
 * comparator, tiebreaks included, so the reversed list is exactly the list
 * read from the bottom — absent values included, now at the front.
 */

export const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'smart', label: 'Default' },
  { id: 'priority', label: 'Priority' },
  { id: 'due', label: 'Due date' },
  { id: 'name', label: 'Name' },
  { id: 'manual', label: 'Manual' },
];

const NO_PRIORITY = 5;
const NO_DATE = '9999-12-31';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * The stable tail every comparator ends on. Without it, adding one task
 * somewhere else could reshuffle rows that had nothing to do with it.
 */
export function byTitleThenId(a: Task, b: Task): number {
  return collator.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const byPriority = (a: Task, b: Task) => (a.priority ?? NO_PRIORITY) - (b.priority ?? NO_PRIORITY);

function byDue(a: Task, b: Task): number {
  const da = a.dueDate ?? NO_DATE;
  const db = b.dueDate ?? NO_DATE;
  return da === db ? 0 : da < db ? -1 : 1;
}

/** What pulls hardest, then what is closest, then how you arranged it. */
export function bySmart(a: Task, b: Task): number {
  return byPriority(a, b) || byDue(a, b) || a.order - b.order || byTitleThenId(a, b);
}

export function compareTasks(sortBy: SortBy, reverse = false): (a: Task, b: Task) => number {
  const compare = ((): ((a: Task, b: Task) => number) => {
    switch (sortBy) {
      case 'priority':
        return (a, b) => byPriority(a, b) || byTitleThenId(a, b);
      case 'due':
        return (a, b) => byDue(a, b) || byTitleThenId(a, b);
      case 'name':
        return byTitleThenId;
      case 'manual':
        return (a, b) => a.order - b.order || byTitleThenId(a, b);
      case 'smart':
        return bySmart;
    }
  })();
  return reverse ? (a, b) => -compare(a, b) : compare;
}

export function byNewestCompletion(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0) || byTitleThenId(a, b);
}
