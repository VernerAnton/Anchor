import type { Label, Project, Task } from '../types/task';
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
  labels: Label[];
  onNewLabel: () => void;
  onEditLabel: (label: Label) => void;
  onOpenSync: () => void;
  syncMode: SyncMode;
}

const VIEWS: { selection: Selection; label: string }[] = [
  { selection: { kind: 'today' }, label: 'Today' },
  { selection: { kind: 'upcoming' }, label: 'Upcoming' },
  { selection: { kind: 'all' }, label: 'All tasks' },
  { selection: { kind: 'path' }, label: 'Path' },
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
  labels,
  onNewLabel,
  onEditLabel,
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
                    ? 'nav-link brackets nav-link--current'
                    : 'nav-link brackets'
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

      {/*
        The second identity axis, and flat where projects nest. A label cuts
        across projects, so its list is the one place tasks from anywhere sit
        together — which is exactly what makes it worth having next to a tree
        that can only ever show you one branch.
      */}
      <div className="sidebar__section-head">
        <h2>Labels</h2>
        <button type="button" className="row-action" aria-label="New label" onClick={onNewLabel}>
          +
        </button>
      </div>

      <ul className="label-list">
        {labels
          .filter((l) => !l.archived)
          .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name)))
          .map((label) => {
            const key = selectionKey({ kind: 'label', labelId: label.id });
            const count = countFor({ kind: 'label', labelId: label.id }, tasks, today);
            return (
              <li key={label.id} className="project-row">
                <button
                  type="button"
                  className={
                    current === key ? 'nav-link brackets nav-link--current' : 'nav-link brackets'
                  }
                  onClick={() => onSelect({ kind: 'label', labelId: label.id })}
                >
                  <span className="label-chip" data-color={label.colorId} aria-hidden="true" />
                  <span className="nav-link__label">{label.name}</span>
                  {count > 0 && <span className="badge">{count}</span>}
                </button>
                <button
                  type="button"
                  className="row-action"
                  aria-label={`Edit label ${label.name}`}
                  onClick={() => onEditLabel(label)}
                >
                  ✎
                </button>
              </li>
            );
          })}
        {labels.filter((l) => !l.archived).length === 0 && (
          <li className="sidebar__hint">No labels yet.</li>
        )}
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
