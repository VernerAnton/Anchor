import type { Task } from '../types/task';

/**
 * How rows are ordered within a section. Phase 3 adds the choice of sort; this
 * is the default every list uses until then.
 *
 * Absent values sort last, always — an unprioritised task is not a P5 and an
 * undated one is not overdue, but something has to go somewhere, and the end
 * is the position that implies no judgement.
 */

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

/** What pulls hardest, then what is closest, then how you arranged it. */
export function bySmart(a: Task, b: Task): number {
  const pa = a.priority ?? NO_PRIORITY;
  const pb = b.priority ?? NO_PRIORITY;
  if (pa !== pb) return pa - pb;
  const da = a.dueDate ?? NO_DATE;
  const db = b.dueDate ?? NO_DATE;
  if (da !== db) return da < db ? -1 : 1;
  return a.order - b.order || byTitleThenId(a, b);
}

export function byNewestCompletion(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0) || byTitleThenId(a, b);
}
