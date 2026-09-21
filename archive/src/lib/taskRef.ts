import type { Project, Task } from '../types/task';

/**
 * A short, stable handle for a task — `HLT-004`, `STU-201`, `GEN-018`.
 *
 * Derived, never stored. A stored counter would need a migration, would have
 * to be kept unique across two devices editing offline, and would be one more
 * thing capable of drifting. Deriving it from the id the task already carries
 * means the reference is correct the moment the task exists and can never
 * disagree with anything.
 *
 * The prefix follows the project, so re-filing a task changes its reference.
 * That is the right behaviour: the reference says where the work lives now,
 * and it is a label to read, never a key to look anything up by.
 */

const FALLBACK_PREFIX = 'GEN';

/** Three letters from the project name, or GEN for anything unfiled. */
function prefixFor(project: Project | null): string {
  if (project === null) return FALLBACK_PREFIX;
  const letters = project.name.toUpperCase().replace(/[^A-Z]/g, '');
  return letters.length >= 3 ? letters.slice(0, 3) : (letters + FALLBACK_PREFIX).slice(0, 3);
}

/**
 * A number in 1..999 from the task id. Any id shape works — uuids and the
 * `id-…` fallback both hash the same way — so this never depends on how ids
 * happen to be generated today.
 */
function numberFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 999) + 1;
}

export function taskRef(task: Task, projects: Project[]): string {
  const project = projects.find((p) => p.id === task.projectId) ?? null;
  return `${prefixFor(project)}-${String(numberFor(task.id)).padStart(3, '0')}`;
}
