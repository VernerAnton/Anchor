import type { Label } from '../types/task';

/**
 * Finding and naming labels, for the picker that searches and creates in one
 * box.
 *
 * All of it is here rather than in the component because it is the part that
 * has to be right: which label a typed name means, whether a name is new, and
 * where a comma ends one label and starts the next. The component keeps the
 * caret and the highlight and nothing else.
 */

/** Collapses the whitespace a name picks up from typing, pasting or a comma. */
export function normalizeLabelName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * The label a typed name refers to, matched case-insensitively — "Focus" and
 * "focus" are one label, and a picker that made two of them would be lying
 * about what typing a name does. Archived labels don't answer: the name is
 * free again, and a new one is what you meant.
 */
export function findLabelByName(labels: Label[], name: string): Label | null {
  const wanted = normalizeLabelName(name).toLowerCase();
  if (wanted === '') return null;
  return labels.find((l) => !l.archived && l.name.toLowerCase() === wanted) ?? null;
}

/** The list's own order, so the picker and the sidebar never disagree. */
export function byLabelOrder(a: Label, b: Label): number {
  return a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name);
}

export type LabelSuggestion =
  | { kind: 'existing'; label: Label }
  | { kind: 'create'; name: string };

/**
 * What to offer for what has been typed: the labels that match and aren't
 * already on the task, then — only when nothing is called that already — the
 * offer to make one.
 *
 * An empty query offers everything still available, so opening the box is also
 * how you see what labels exist. That was the whole job of the old wall of
 * chips, and it's the one thing worth keeping from it.
 */
export function suggestLabels(labels: Label[], worn: string[], query: string): LabelSuggestion[] {
  const wanted = normalizeLabelName(query).toLowerCase();

  const suggestions: LabelSuggestion[] = labels
    .filter((l) => !l.archived && !worn.includes(l.id))
    .filter((l) => wanted === '' || l.name.toLowerCase().includes(wanted))
    .sort(byLabelOrder)
    .map((label) => ({ kind: 'existing', label }));

  // A name the task already wears is not a new label either, which is why this
  // asks the whole list rather than only the ones offered above.
  if (wanted !== '' && findLabelByName(labels, query) === null) {
    suggestions.push({ kind: 'create', name: normalizeLabelName(query) });
  }

  return suggestions;
}

/**
 * Splits typed or pasted text on commas. Everything before the last comma is
 * finished and ready to go on; whatever follows it is still being typed.
 *
 * This is what makes one paste of "focus, deep work, errand" land as three
 * labels without the box needing a separate paste path.
 */
export function splitLabelInput(value: string): { commit: string[]; rest: string } {
  const parts = value.split(',');
  const rest = parts.pop() ?? '';
  return {
    commit: parts.map(normalizeLabelName).filter((name) => name !== ''),
    // Only the leading space a comma leaves behind — the ones inside a name
    // are part of it, and the trailing one is still being typed.
    rest: rest.replace(/^\s+/, ''),
  };
}
