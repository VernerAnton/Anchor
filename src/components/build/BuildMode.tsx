import { useEffect, useMemo, useState } from 'react';
import type { Project, ProjectColor, Task } from '../../types/task';
import type { SyncMode } from '../../store';
import { repository } from '../../store';
import type { TaskDraft } from '../../store/mutations';
import {
  archiveTask,
  editProject,
  editTask,
  newProject,
  newTask,
} from '../../store/mutations';
import { useProjects, useTasks } from '../../hooks/useStore';
import { ProjectMark } from './ProjectMark';
import { ProjectEditor } from './ProjectEditor';
import { TaskEditor } from './TaskEditor';
import { SyncSettings } from '../SyncSettings';
import { RouteBuilder } from './RouteBuilder';

type Panel =
  | { kind: 'none' }
  | { kind: 'task'; task: Task | null }
  | { kind: 'project'; project: Project | null }
  | { kind: 'sync' };

interface Props {
  syncMode: SyncMode;
  onClose: () => void;
}

/**
 * The workshop.
 *
 * A separate place rather than a mode of the path, because deciding and doing
 * are supposed to happen at different times in different states — that
 * separation is the mechanism the whole app rests on, not a UI convenience.
 *
 * Same palette, same type, same clipped corners as the route: it has to read as
 * the same app. What it drops is glow, pulse and every one of the four colours
 * that mean something on the path. Not plainer materials — the same room with
 * the lights up. If the workshop were the more rewarding place to be, that's
 * where the time would go, and organising would quietly replace doing.
 */
export function BuildMode({ syncMode, onClose }: Props) {
  const tasks = useTasks();
  const projects = useProjects();
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [showArchived, setShowArchived] = useState(false);
  /**
   * Two jobs, kept apart. The library is what exists; routes are what's placed
   * on a day. Opening on Routes because assembling tomorrow is the reason to
   * come here at all — the library is where you go when that runs short.
   */
  const [tab, setTab] = useState<'routes' | 'library'>('routes');

  // The phone back button should leave the workshop, not the app.
  useEffect(() => {
    history.pushState({ anchorBuild: true }, '');
    const pop = () => onClose();
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [onClose]);

  const visible = useMemo(() => {
    const inScope = tasks.filter((task) => showArchived || !task.archived);
    const filtered =
      selected === null ? inScope : inScope.filter((task) => task.projectId === selected);
    return [...filtered].sort(
      (a, b) => (a.priority ?? 9) - (b.priority ?? 9) || a.title.localeCompare(b.title),
    );
  }, [tasks, selected, showArchived]);

  const projectOf = (id: string | null) => projects.find((project) => project.id === id);
  const countIn = (id: string | null) =>
    tasks.filter((task) => !task.archived && (id === null || task.projectId === id)).length;

  const saveTask = (draft: TaskDraft) => {
    const existing = panel.kind === 'task' ? panel.task : null;
    void repository.saveTask(existing ? editTask(existing, draft) : newTask(draft));
    setPanel({ kind: 'none' });
  };

  const saveProject = (name: string, colorId: ProjectColor) => {
    const existing = panel.kind === 'project' ? panel.project : null;
    void repository.saveProject(
      existing ? editProject(existing, { name, colorId }) : newProject(name, projects.length, colorId),
    );
    setPanel({ kind: 'none' });
  };

  return (
    <div className="build">
      <div className="build-bar">
        <span className="build-title">Workshop</span>
        <span className="build-bar-tools">
          <button type="button" className="build-close" onClick={() => setPanel({ kind: 'sync' })}>
            {syncMode === 'cloud' ? 'Sync · on' : 'Sync'}
          </button>
          <button type="button" className="build-close" onClick={onClose}>
            Close ✕
          </button>
        </span>
      </div>

      <div className="seg tabs">
        <button type="button" className={tab === 'routes' ? 'on' : ''} onClick={() => setTab('routes')}>
          Routes
        </button>
        <button type="button" className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>
          Library
        </button>
      </div>

      {tab === 'routes' ? (
        <>
          {panel.kind === 'sync' && (
            <SyncSettings mode={syncMode} onClose={() => setPanel({ kind: 'none' })} />
          )}
          <RouteBuilder tasks={tasks} projects={projects} />
        </>
      ) : (
      <>
      <nav className="plist">
        <button
          type="button"
          className={`prow${selected === null ? ' on' : ''}`}
          onClick={() => setSelected(null)}
        >
          <span>All tasks</span>
          <b>{countIn(null)}</b>
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={`prow${selected === project.id ? ' on' : ''}`}
            onClick={() => setSelected(project.id)}
            onDoubleClick={() => setPanel({ kind: 'project', project })}
          >
            <ProjectMark project={project} />
            <b>{countIn(project.id)}</b>
          </button>
        ))}
        <button
          type="button"
          className="prow add"
          onClick={() => setPanel({ kind: 'project', project: null })}
        >
          + Project
        </button>
      </nav>

      <div className="build-actions">
        <button type="button" onClick={() => setPanel({ kind: 'task', task: null })}>
          + Task
        </button>
        {selected !== null && (
          <button
            type="button"
            onClick={() => {
              const project = projectOf(selected);
              if (project) setPanel({ kind: 'project', project });
            }}
          >
            Edit project
          </button>
        )}
        <button type="button" onClick={() => setShowArchived((on) => !on)}>
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>

      {panel.kind === 'task' && (
        <TaskEditor
          task={panel.task}
          projects={projects}
          defaultProjectId={selected}
          onSave={saveTask}
          onCancel={() => setPanel({ kind: 'none' })}
        />
      )}
      {panel.kind === 'project' && (
        <ProjectEditor
          project={panel.project}
          onSave={saveProject}
          onCancel={() => setPanel({ kind: 'none' })}
        />
      )}
      {panel.kind === 'sync' && (
        <SyncSettings mode={syncMode} onClose={() => setPanel({ kind: 'none' })} />
      )}

      <ul className="tlist">
        {visible.map((task) => (
          <li key={task.id} className={`trow${task.archived ? ' archived' : ''}`}>
            <div className="trow-main">
              <span className="trow-title">{task.title}</span>
              <span className="trow-sub">
                {task.firstMove} · {task.type} ·{' '}
                {task.defaultDuration.kind === 'fixed'
                  ? `${task.defaultDuration.minutes} min`
                  : `~${task.defaultDuration.estimateMinutes} min, ends on its own`}
              </span>
            </div>
            <div className="trow-side">
              {task.priority && <span className="prio">P{task.priority}</span>}
              <ProjectMark project={projectOf(task.projectId)} />
            </div>
            <div className="trow-tools">
              <button type="button" onClick={() => setPanel({ kind: 'task', task })}>
                Edit
              </button>
              <button
                type="button"
                onClick={() => void repository.saveTask(archiveTask(task, !task.archived))}
              >
                {task.archived ? 'Restore' : 'Archive'}
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="tempty">
            Nothing here yet. Tasks made here are what you put on a route.
          </li>
        )}
      </ul>
      </>
      )}
    </div>
  );
}
