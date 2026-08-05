import type { Project, Task } from '../types/task';
import type { SyncMode } from '../store';
import { countFor, projectTree, selectionKey, type Selection } from '../lib/views';
import { buildInfo } from '../lib/build';

// Constant for the lifetime of the bundle — computed once, not per render.
const build = buildInfo();

interface Props {
  open: boolean;
  selection: Selection;
  tasks: Task[];
  projects: Project[];
  today: string;
  onSelect: (selection: Selection) => void;
  onNewProject: (parentId: string | null) => void;
  onEditProject: (project: Project) => void;
  onOpenSync: () => void;
  syncMode: SyncMode;
}

const VIEWS: { selection: Selection; label: string }[] = [
  { selection: { kind: 'today' }, label: 'Today' },
  { selection: { kind: 'upcoming' }, label: 'Upcoming' },
  { selection: { kind: 'all' }, label: 'All tasks' },
];

export function Sidebar({
  open,
  selection,
  tasks,
  projects,
  today,
  onSelect,
  onNewProject,
  onEditProject,
  onOpenSync,
  syncMode,
}: Props) {
  const current = selectionKey(selection);
  const tree = projectTree(projects);

  const projectRow = (project: Project, child: boolean) => {
    const rowSelection: Selection = { kind: 'project', projectId: project.id };
    const count = countFor(rowSelection, tasks, today);
    return (
      <li key={project.id} className={child ? 'project-row project-row--child' : 'project-row'}>
        <button
          type="button"
          className={
            current === selectionKey(rowSelection) ? 'nav-link nav-link--current' : 'nav-link'
          }
          onClick={() => onSelect(rowSelection)}
        >
          <span className="project-dot" data-color={project.colorId} aria-hidden="true" />
          <span className="nav-link__label">{project.name}</span>
          {count > 0 && <span className="badge">{count}</span>}
        </button>
        <button
          type="button"
          className="row-action"
          aria-label={`Edit project ${project.name}`}
          onClick={() => onEditProject(project)}
        >
          ✎
        </button>
      </li>
    );
  };

  return (
    <nav className={open ? 'sidebar sidebar--open' : 'sidebar'} aria-label="Views and projects">
      <div className="sidebar__brand">Anchor</div>

      <ul className="sidebar__views">
        {VIEWS.map(({ selection: viewSelection, label }) => {
          const count = countFor(viewSelection, tasks, today);
          return (
            <li key={selectionKey(viewSelection)}>
              <button
                type="button"
                className={
                  current === selectionKey(viewSelection)
                    ? 'nav-link nav-link--current'
                    : 'nav-link'
                }
                onClick={() => onSelect(viewSelection)}
              >
                <span className="nav-link__label">{label}</span>
                {count > 0 && <span className="badge">{count}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sidebar__section-head">
        <h2>Projects</h2>
        <button
          type="button"
          className="row-action"
          aria-label="New project"
          onClick={() => onNewProject(null)}
        >
          +
        </button>
      </div>

      <ul className="project-tree">
        {tree.map(({ project, children }) => (
          <li key={project.id}>
            <ul className="project-branch">
              {projectRow(project, false)}
              {children.map((child) => projectRow(child, true))}
            </ul>
          </li>
        ))}
        {tree.length === 0 && <li className="sidebar__hint">No projects yet.</li>}
      </ul>

      <div className="sidebar__foot">
        <button type="button" className="nav-link" onClick={onOpenSync}>
          <span className="nav-link__label">Sync</span>
          <span className="sidebar__sync-state">
            {syncMode === 'cloud' ? 'connected' : 'this device'}
          </span>
        </button>
        <p className="sidebar__build" title={build.detail}>
          {build.label}
        </p>
      </div>
    </nav>
  );
}
