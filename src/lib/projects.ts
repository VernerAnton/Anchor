import type { Project, ProjectColor, Task } from '../types/task';

/**
 * The project tree and the shapes built from it, as data.
 *
 * One level of nesting: a project whose parent is missing or archived is
 * shown at the top level rather than lost.
 */

export interface ProjectRef {
  id: string;
  name: string;
  colorId: ProjectColor;
}

export interface ProjectNode extends ProjectRef {
  children: ProjectRef[];
}

const byOrder = (a: Project, b: Project) =>
  a.order - b.order || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1);

export const toRef = (p: Project): ProjectRef => ({ id: p.id, name: p.name, colorId: p.colorId });

export function projectTree(projects: readonly Project[]): ProjectNode[] {
  const live = projects.filter((p) => !p.archived);
  const liveIds = new Set(live.map((p) => p.id));
  return live
    .filter((p) => p.parentId === null || !liveIds.has(p.parentId))
    .sort(byOrder)
    .map((p) => ({
      ...toRef(p),
      children: live
        .filter((child) => child.parentId === p.id)
        .sort(byOrder)
        .map(toRef),
    }));
}

export function archivedProjects(projects: readonly Project[]): ProjectRef[] {
  return projects
    .filter((p) => p.archived)
    .sort(byOrder)
    .map(toRef);
}

/** The ids a project's own list covers: itself and its sub-projects. */
export function projectScope(projectId: string, projects: readonly Project[]): string[] {
  return [projectId, ...projects.filter((p) => p.parentId === projectId).map((p) => p.id)];
}

/** Choices for "file under", in tree order. Depth says how far to indent. */
export interface ProjectOption {
  id: string;
  name: string;
  depth: 0 | 1;
}

export function projectOptions(projects: readonly Project[], currentId: string | null): ProjectOption[] {
  const options: ProjectOption[] = projectTree(projects).flatMap((node) => [
    { id: node.id, name: node.name, depth: 0 as const },
    ...node.children.map((child) => ({ id: child.id, name: child.name, depth: 1 as const })),
  ]);
  // A task filed under an archived project keeps showing where it is.
  const current = currentId ? projects.find((p) => p.id === currentId) : undefined;
  if (current && !options.some((o) => o.id === current.id)) {
    options.push({ id: current.id, name: `${current.name} (archived)`, depth: 0 });
  }
  return options;
}

/** Everything the inline project editor needs, decided. */
export interface ProjectEditorModel {
  id: string;
  name: string;
  colorId: ProjectColor;
  parentId: string | null;
  archived: boolean;
  /** Projects this one could nest under. Empty when it has children of its own. */
  parentOptions: ProjectRef[];
  /** Only a project nothing has ever been filed under can go; the rest archive. */
  deletable: boolean;
}

export function projectEditorModel(
  projectId: string,
  projects: readonly Project[],
  tasks: readonly Task[],
): ProjectEditorModel | null {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;
  const hasChildren = projects.some((p) => p.parentId === project.id);
  return {
    ...toRef(project),
    parentId: project.parentId,
    archived: project.archived,
    parentOptions: hasChildren
      ? []
      : projects
          .filter((p) => !p.archived && p.parentId === null && p.id !== project.id)
          .sort(byOrder)
          .map(toRef),
    deletable: !hasChildren && !tasks.some((t) => t.projectId === project.id),
  };
}
