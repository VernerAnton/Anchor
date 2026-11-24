import type { Task } from '../types/task';
import { flatRows, type TaskRowModel, type ViewInput } from './views';
import { byNewestCompletion, bySmart } from './sorting';

/**
 * Finding a task. One box, matching titles and notes, ignoring case.
 *
 * Deliberately small: no operators, no saved searches, no fuzzy matching.
 * Typing several words finds tasks containing all of them, in any order and
 * anywhere in the title or notes — "call bank" finds "Call the bank". That's
 * what a person expects of a search box, not an operator to learn.
 */

export interface SearchModel {
  query: string;
  /** Open matches first, ordered as the app orders everything else. */
  open: TaskRowModel[];
  /** Done matches, newest first. */
  completed: TaskRowModel[];
  /** What to say when there's nothing to show. Never a judgement. */
  message: string | null;
}

/** The words of a query, lower-cased. Empty for a blank query. */
export function searchTerms(query: string): string[] {
  return query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesTask(task: Task, terms: readonly string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = `${task.title}\n${task.notes ?? ''}`.toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * The note line worth showing for a match found in the notes: the first line
 * holding a searched word. A row normally shows the note's first line; when the
 * match is further down, the line that matched is the one that explains why the
 * task is here.
 */
function matchingLine(notes: string | null, terms: readonly string[]): string | null {
  if (notes === null) return null;
  const line = notes
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l !== '' && terms.some((term) => l.toLocaleLowerCase().includes(term)));
  return line ?? null;
}

export function searchTasks(input: Omit<ViewInput, 'selection'>, query: string): SearchModel {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return { query, open: [], completed: [], message: 'Type to search titles and notes.' };
  }

  const found = input.tasks.filter((task) => !task.archived && matchesTask(task, terms));
  const withLine = (tasks: Task[]) =>
    flatRows(input, tasks).map((row, i) => {
      const task = tasks[i]!;
      const inTitle = terms.every((term) => task.title.toLocaleLowerCase().includes(term));
      return inTitle ? row : { ...row, note: matchingLine(task.notes, terms) ?? row.note };
    });

  const open = found.filter((t) => t.completedAt === null).sort(bySmart);
  const done = found.filter((t) => t.completedAt !== null).sort(byNewestCompletion);
  return {
    query,
    open: withLine(open),
    completed: withLine(done),
    message: found.length === 0 ? `Nothing matches “${query.trim()}”.` : null,
  };
}
