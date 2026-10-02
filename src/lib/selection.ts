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
  | { kind: 'project'; projectId: string };

export const DEFAULT_SELECTION: Selection = { kind: 'today' };

export function parseHash(hash: string): Selection {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'upcoming') return { kind: 'upcoming' };
  if (path === 'all') return { kind: 'all' };
  if (path === 'today') return { kind: 'today' };
  const project = /^project\/(.+)$/.exec(path);
  if (project?.[1]) return { kind: 'project', projectId: decodeURIComponent(project[1]) };
  return DEFAULT_SELECTION;
}

export function selectionHref(selection: Selection): string {
  if (selection.kind === 'project') return `#project/${encodeURIComponent(selection.projectId)}`;
  return `#${selection.kind}`;
}

export function sameSelection(a: Selection, b: Selection): boolean {
  return selectionHref(a) === selectionHref(b);
}
