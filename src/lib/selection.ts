/**
 * Which list is on screen, and how that's written in the URL.
 *
 * The hash is the source of truth, so a reload, the back button and a link
 * from another device all land on the same view. Pure: parsing and formatting
 * only — `App` owns listening for changes.
 */

export type Selection =
  | { kind: 'today' }
  | { kind: 'upcoming' }
  | { kind: 'all' }
  | { kind: 'project'; projectId: string }
  | { kind: 'label'; labelId: string }
  /** Every label, to rename and reorder in place. Not a task list. */
  | { kind: 'labels' }
  /** Sync, appearance, sample tasks, version. Not a task list. */
  | { kind: 'settings' }
  /** Search titles and notes. The query lives in the URL, so Back returns to it. */
  | { kind: 'search'; query: string };

/** Selections that show a task list. */
export type ListSelection = Exclude<
  Selection,
  { kind: 'labels' } | { kind: 'settings' } | { kind: 'search' }
>;

export function isListSelection(selection: Selection): selection is ListSelection {
  return selection.kind !== 'labels' && selection.kind !== 'settings' && selection.kind !== 'search';
}

export const DEFAULT_SELECTION: Selection = { kind: 'today' };

export function parseHash(hash: string): Selection {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'upcoming') return { kind: 'upcoming' };
  if (path === 'all') return { kind: 'all' };
  if (path === 'today') return { kind: 'today' };
  if (path === 'labels') return { kind: 'labels' };
  if (path === 'settings') return { kind: 'settings' };
  if (path === 'search') return { kind: 'search', query: '' };
  const search = /^search\/(.*)$/.exec(path);
  if (search) return { kind: 'search', query: safeDecode(search[1] ?? '') };
  const project = /^project\/(.+)$/.exec(path);
  if (project?.[1]) return { kind: 'project', projectId: decodeURIComponent(project[1]) };
  const label = /^label\/(.+)$/.exec(path);
  if (label?.[1]) return { kind: 'label', labelId: decodeURIComponent(label[1]) };
  return DEFAULT_SELECTION;
}

/** A hand-edited or truncated URL shouldn't take the app down. */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function selectionHref(selection: Selection): string {
  if (selection.kind === 'project') return `#project/${encodeURIComponent(selection.projectId)}`;
  if (selection.kind === 'label') return `#label/${encodeURIComponent(selection.labelId)}`;
  if (selection.kind === 'search') {
    return selection.query ? `#search/${encodeURIComponent(selection.query)}` : '#search';
  }
  return `#${selection.kind}`;
}

/** The key a view's sort and grouping are stored under in settings. */
export function viewKey(selection: ListSelection): string {
  if (selection.kind === 'project') return `project:${selection.projectId}`;
  if (selection.kind === 'label') return `label:${selection.labelId}`;
  return selection.kind;
}

export function sameSelection(a: Selection, b: Selection): boolean {
  return selectionHref(a) === selectionHref(b);
}
