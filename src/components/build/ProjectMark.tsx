import type { Project } from '../../types/task';
import { PROJECT_COLORS } from '../../types/task';

/**
 * Where a thing is from, at a glance.
 *
 * Muted by construction — project colour is identity, not state, and the four
 * neon colours are spoken for. Rendered small and quiet so it never competes
 * with the status word sitting beside it on a point.
 */
export function ProjectMark({ project }: { project: Project | undefined }) {
  if (!project) return null;
  return (
    <span className="pmark" style={{ color: PROJECT_COLORS[project.colorId] }}>
      <span className="pmark-dot" aria-hidden="true" />
      {project.name}
    </span>
  );
}
