import type { Label, Project, Task } from '../types/task';
import type { GroupBy } from '../types/settings';
import { projectTree } from './projects';

/**
 * Cutting a list into one section per project or per label.
 *
 * Groups come in the sidebar's own order, so the sections read down the page
 * in the order you arranged them. Empty groups are left out. The unfiled group
 * goes last and is always named — "No label" is true and useful to read; an
 * untitled section of leftovers is a puzzle.
 *
 * **A task with two labels appears under both.** That is what having two
 * labels means; showing it under only the first would make the second a lie.
 * Grouping by project can't do this — a task has exactly one.
 */

export const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'project', label: 'Project' },
  { id: 'label', label: 'Label' },
];

export interface Group<T extends { task: Task }> {
  key: string;
  title: string;
  items: T[];
  /** What the heading already says, so rows needn't repeat it. */
  projectId: string | null;
  labelId: string | null;
}

export function groupItems<T extends { task: Task }>(
  items: readonly T[],
  groupBy: Exclude<GroupBy, 'none'>,
  projects: readonly Project[],
  labels: readonly Label[],
): Group<T>[] {
  if (groupBy === 'project') {
    const ordered = projectTree(projects).flatMap((node) => [node, ...node.children]);
    const known = new Set(ordered.map((p) => p.id));
    const groups: Group<T>[] = ordered.map((project) => ({
      key: `project:${project.id}`,
      title: project.name,
      items: items.filter((item) => item.task.projectId === project.id),
      projectId: project.id,
      labelId: null,
    }));
    groups.push({
      key: 'project:none',
      title: 'No project',
      items: items.filter((item) => item.task.projectId === null || !known.has(item.task.projectId)),
      projectId: null,
      labelId: null,
    });
    return groups.filter((group) => group.items.length > 0);
  }

  const live = labels
    .filter((label) => !label.archived)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const liveIds = new Set(live.map((label) => label.id));
  const groups: Group<T>[] = live.map((label) => ({
    key: `label:${label.id}`,
    title: label.name,
    items: items.filter((item) => item.task.labelIds.includes(label.id)),
    projectId: null,
    labelId: label.id,
  }));
  // Unlabelled means carrying none the app still knows about — an id left by
  // a label deleted elsewhere shouldn't strand a task.
  groups.push({
    key: 'label:none',
    title: 'No label',
    items: items.filter((item) => !item.task.labelIds.some((id) => liveIds.has(id))),
    projectId: null,
    labelId: null,
  });
  return groups.filter((group) => group.items.length > 0);
}
