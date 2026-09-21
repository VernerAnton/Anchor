import type { Label, Project } from '../types/task';
import type { TaskListItem, TaskSection } from './views';

/**
 * How a flat list is cut into sections.
 *
 * `none` is not "no sections" — it means the view's own sections, which for
 * Today are the date ones it has always had. Grouping replaces what's inside
 * those, never the fact that a view knows how to arrange itself.
 */
export type GroupBy = 'none' | 'project' | 'label';

export const GROUP_BY_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'project', label: 'Project' },
  { id: 'label', label: 'Label' },
];

const byOrder = <T extends { order: number; name: string }>(a: T, b: T): number =>
  a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name);

/**
 * Cuts a list of rows into one section per project or per label.
 *
 * Groups come in the sidebar's own order, so the sections you read down the
 * page are in the order you arranged them in — not alphabetical, and not
 * whatever order the tasks happened to be in. Empty groups are left out: a
 * heading with nothing under it is a heading that costs a line and says
 * nothing.
 *
 * The unfiled group goes last and is always named, never blank. "No label" is
 * a true and useful thing to read at the bottom of a list; an untitled section
 * of leftovers is a puzzle.
 *
 * **A task with two labels appears under both.** That is what having more than
 * one label means, and hiding it under only the first would make the second
 * label a lie. Grouping by project can't do this — a task has exactly one.
 */
export function groupItems(
  items: TaskListItem[],
  groupBy: GroupBy,
  projects: Project[],
  labels: Label[],
): TaskSection[] {
  if (groupBy === 'none') return [];

  if (groupBy === 'project') {
    const sections = projects
      .filter((p) => !p.archived)
      .sort(byOrder)
      .map((project) => ({
        key: `project:${project.id}`,
        title: project.name,
        items: items.filter((i) => i.task.projectId === project.id),
      }))
      .filter((section) => section.items.length > 0);

    const unfiled = items.filter(
      (i) => i.task.projectId === null || !projects.some((p) => p.id === i.task.projectId),
    );
    if (unfiled.length > 0) {
      sections.push({ key: 'project:none', title: 'No project', items: unfiled });
    }
    return sections;
  }

  const sections = labels
    .filter((l) => !l.archived)
    .sort(byOrder)
    .map((label) => ({
      key: `label:${label.id}`,
      title: label.name,
      items: items.filter((i) => (i.task.labelIds ?? []).includes(label.id)),
    }))
    .filter((section) => section.items.length > 0);

  // Unlabelled means carrying none the app still knows about — an id left over
  // from a label that was deleted elsewhere shouldn't strand a task.
  const live = new Set(labels.filter((l) => !l.archived).map((l) => l.id));
  const unlabelled = items.filter((i) => !(i.task.labelIds ?? []).some((id) => live.has(id)));
  if (unlabelled.length > 0) {
    sections.push({ key: 'label:none', title: 'No label', items: unlabelled });
  }
  return sections;
}

/**
 * Re-sections what a view already built.
 *
 * Sections the view considers structural — Today's "Earlier" — are left alone
 * and stay on top. Overdue is a fact about the date, not about which project
 * something is filed under, and burying it inside "Salesforce" would lose the
 * one thing that section exists to say.
 */
export function regroup(
  sections: TaskSection[],
  groupBy: GroupBy,
  projects: Project[],
  labels: Label[],
  keepKeys: string[] = ['earlier'],
): TaskSection[] {
  if (groupBy === 'none') return sections;

  const kept = sections.filter((s) => keepKeys.includes(s.key));
  const regrouped = sections.filter((s) => !keepKeys.includes(s.key)).flatMap((s) => s.items);
  return [...kept, ...groupItems(regrouped, groupBy, projects, labels)];
}

/** How many rows a section holds, counting nested subtasks. */
export function sectionCount(section: TaskSection): number {
  return section.items.length;
}
