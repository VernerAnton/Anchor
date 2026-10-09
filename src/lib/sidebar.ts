import type { Label, Project, Task } from '../types/task';
import { archivedProjects, projectTree, type ProjectRef } from './projects';
import { sameSelection, selectionHref, type ListSelection, type Selection } from './selection';
import { countFor, labelsScreen, type LabelRef } from './views';

/** Everything the sidebar shows, decided: where each entry goes, its count, whether it's current. */

export interface NavItem {
  key: string;
  href: string;
  label: string;
  count: number;
  current: boolean;
}

export interface ProjectNavItem extends ProjectRef {
  href: string;
  count: number;
  current: boolean;
}

export interface ProjectNavNode extends ProjectNavItem {
  children: ProjectNavItem[];
}

export interface LabelNavItem extends LabelRef {
  href: string;
  count: number;
  current: boolean;
}

export interface SidebarModel {
  views: NavItem[];
  projects: ProjectNavNode[];
  archived: ProjectNavItem[];
  labels: LabelNavItem[];
  /** The labels screen, where they're renamed and reordered. */
  manageLabels: { href: string; current: boolean };
}

const VIEWS: { selection: ListSelection; label: string }[] = [
  { selection: { kind: 'today' }, label: 'Today' },
  { selection: { kind: 'upcoming' }, label: 'Upcoming' },
  { selection: { kind: 'all' }, label: 'All tasks' },
];

export function sidebarModel(
  current: Selection,
  tasks: readonly Task[],
  projects: readonly Project[],
  labels: readonly Label[],
  today: string,
): SidebarModel {
  const item = (selection: ListSelection) => ({
    href: selectionHref(selection),
    count: countFor({ selection, tasks, projects, labels, today }),
    current: sameSelection(selection, current),
  });
  const projectItem = (ref: ProjectRef): ProjectNavItem => ({
    ...ref,
    ...item({ kind: 'project', projectId: ref.id }),
  });

  return {
    views: VIEWS.map(({ selection, label }) => ({ key: selection.kind, label, ...item(selection) })),
    projects: projectTree(projects).map((node) => ({
      ...projectItem(node),
      children: node.children.map(projectItem),
    })),
    archived: archivedProjects(projects).map((ref) => ({ ...projectItem(ref), count: 0 })),
    labels: labelsScreen(labels, tasks).map((row) => {
      const selection: ListSelection = { kind: 'label', labelId: row.id };
      return {
        id: row.id,
        name: row.name,
        colorId: row.colorId,
        href: selectionHref(selection),
        count: row.count,
        current: sameSelection(selection, current),
      };
    }),
    manageLabels: { href: selectionHref({ kind: 'labels' }), current: current.kind === 'labels' },
  };
}
