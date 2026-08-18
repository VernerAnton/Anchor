import type { Task } from '../types/task';
import type { TaskListItem } from './views';

/**
 * How rows are ordered inside whatever section they land in.
 *
 * Sorting and grouping are separate questions and both are answered at once:
 * grouping decides which pile a row goes in, sorting decides where it sits in
 * that pile. Turning one on never turns the other off.
 */
export type SortBy = 'smart' | 'priority' | 'due' | 'name' | 'manual';

export const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'smart', label: 'Default' },
  { id: 'priority', label: 'Priority' },
  { id: 'due', label: 'Due date' },
  { id: 'name', label: 'Name' },
  { id: 'manual', label: 'Manual' },
];

/**
 * Absent values sort last, always — an unprioritised task is not a P5 and an
 * undated one is not overdue, but something has to go somewhere, and "at the
 * end" is the reading that never implies a judgement about it.
 *
 * Reversing brings them to the front. That is the honest consequence of asking
 * for the reverse and not a special case worth suppressing: if you flip the
 * list, the bottom becomes the top.
 */
const NO_PRIORITY = 5;
const NO_DATE = '9999-12-31';

/**
 * Every comparator ends at the title, so two otherwise equal rows always come
 * out in the same order. Without a stable tail, adding one task somewhere else
 * in the list can shuffle rows that had nothing to do with it.
 */
function tail(a: Task, b: Task): number {
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

export function compareTasks(sortBy: SortBy): (a: Task, b: Task) => number {
  switch (sortBy) {
    case 'priority':
      return (a, b) => (a.priority ?? NO_PRIORITY) - (b.priority ?? NO_PRIORITY) || tail(a, b);

    case 'due':
      return (a, b) => {
        const da = a.dueDate ?? NO_DATE;
        const db = b.dueDate ?? NO_DATE;
        return da === db ? tail(a, b) : da < db ? -1 : 1;
      };

    case 'name':
      return tail;

    case 'manual':
      return (a, b) => a.order - b.order || tail(a, b);

    /*
     * The app's own reading of what matters, and what every list used before
     * there was a choice: what pulls hardest, then what is closest, then how
     * you arranged it yourself.
     */
    case 'smart':
      return (a, b) => {
        const pa = a.priority ?? NO_PRIORITY;
        const pb = b.priority ?? NO_PRIORITY;
        if (pa !== pb) return pa - pb;
        const da = a.dueDate ?? NO_DATE;
        const db = b.dueDate ?? NO_DATE;
        if (da !== db) return da < db ? -1 : 1;
        return a.order - b.order || tail(a, b);
      };
  }
}

/**
 * Sorts rows, and their subtasks with them.
 *
 * Reversing negates the whole comparator, tiebreaks included, so the reversed
 * list is exactly the list read from the bottom. Anything else would leave
 * pairs that were equal appearing in a third order nobody asked for.
 */
export function sortItems(items: TaskListItem[], sortBy: SortBy, reverse: boolean): TaskListItem[] {
  const compare = compareTasks(sortBy);
  const ordered = reverse ? (a: Task, b: Task) => -compare(a, b) : compare;
  return [...items]
    .sort((x, y) => ordered(x.task, y.task))
    .map((item) => ({ ...item, subtasks: [...item.subtasks].sort(ordered) }));
}
