import type { Project, Task } from '../types/task';
import { archivedProjects, projectTree, type ProjectRef } from './projects';
import { sameSelection, selectionHref, type Selection } from './selection';
import { countFor } from './views';

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

export interface SidebarModel {
  views: NavItem[];
  projects: ProjectNavNode[];
  archived: ProjectNavItem[];
}

const VIEWS: { selection: Selection; label: string }[] = [
  { selection: { kind: 'today' }, label: 'Today' },
  { selection: { kind: 'upcoming' }, label: 'Upcoming' },
  { selection: { kind: 'all' }, label: 'All tasks' },
];

export function sidebarModel(
  current: Selection,
  tasks: readonly Task[],
  projects: readonly Project[],
  today: string,
): SidebarModel {
  const item = (selection: Selection) => ({
    href: selectionHref(selection),
    count: countFor({ selection, tasks, projects, today }),
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
    archived: archivedProjects(projects).map((ref) => ({
      ...projectItem(ref),
      count: 0,
    })),
  };
}
