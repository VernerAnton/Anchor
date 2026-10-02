import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjects, useTasks } from './hooks/useStore';
import { useNarrowLayout } from './hooks/useNarrowLayout';
import { useFocusAfterRender } from './hooks/useFocusAfterRender';
import { useSelection } from './hooks/useSelection';
import { useToday } from './hooks/useToday';
import { buildList, focusAfterToggle, taskDetail } from './lib/views';
import { sidebarModel } from './lib/sidebar';
import { projectEditorModel } from './lib/projects';
import { buildInfo } from './lib/build';
import * as actions from './store/actions';
import { Sidebar } from './components/Sidebar';
import { TaskListPanel } from './components/TaskListPanel';
import { DetailPanel, DetailPlaceholder, type TaskChanges } from './components/DetailPanel';
import { ProjectEditor, type ProjectChanges } from './components/ProjectEditor';

const BUILD = buildInfo();

/** Plain and blameless: the device failed a write, the person did nothing wrong. */
const WRITE_ERROR = 'That change couldn’t be saved on this device. Your other tasks are unaffected.';

const FALLBACK_TITLES = { today: 'Today', upcoming: 'Upcoming', all: 'All tasks', project: 'Project' };

/**
 * The shell: sidebar, list, detail.
 *
 * App holds only what's genuinely app-wide — which view, which task is open,
 * whether the drawer is out — and wires the store's actions to the components.
 * Every derived state comes from `lib/`; every write goes through
 * `store/actions`.
 */
export function App() {
  const tasks = useTasks();
  const projects = useProjects();
  const today = useToday();
  const narrow = useNarrowLayout();
  const [selection, navigate] = useSelection();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRender = useFocusAfterRender();

  const list = useMemo(
    () =>
      tasks !== null && projects !== null ? buildList({ selection, tasks, projects, today }) : null,
    [selection, tasks, projects, today],
  );
  const sidebar = useMemo(
    () => sidebarModel(selection, tasks ?? [], projects ?? [], today),
    [selection, tasks, projects, today],
  );
  const detail = useMemo(
    () => taskDetail({ tasks: tasks ?? [], projects: projects ?? [], today }, selectedId),
    [tasks, projects, today, selectedId],
  );
  const projectModel = useMemo(
    () =>
      selection.kind === 'project'
        ? projectEditorModel(selection.projectId, projects ?? [], tasks ?? [])
        : null,
    [selection, projects, tasks],
  );

  // A project that no longer exists isn't a place to be; fall back to Today.
  useEffect(() => {
    if (selection.kind === 'project' && projects !== null && projectModel === null) {
      navigate({ kind: 'today' }, true);
    }
  }, [selection, projects, projectModel, navigate]);

  // Each view opens with its project editor closed.
  useEffect(() => setEditingProject(false), [selection]);

  const report = useCallback(<T,>(write: Promise<T>): Promise<T | undefined> => {
    return write.then(
      (value) => {
        setWriteError(null);
        return value;
      },
      (error: unknown) => {
        console.warn('Write failed:', error);
        setWriteError(WRITE_ERROR);
        return undefined;
      },
    );
  }, []);

  const findTask = useCallback((id: string) => tasks?.find((task) => task.id === id), [tasks]);

  // ── Tasks ──

  const onAdd = useCallback(
    (title: string) => {
      if (!tasks || !list) return;
      const { dueDate, projectId } = list.quickAdd;
      void report(actions.addTask(title, { dueDate, projectId, parentId: null }, tasks));
    },
    [tasks, list, report],
  );

  const onToggle = useCallback(
    (id: string, done: boolean) => {
      const task = findTask(id);
      if (!task || !list) return;
      // Only a toggle made from a list row moves focus — the row is about to
      // move to the other list and would take focus with it.
      const fromRow = document.activeElement?.getAttribute('data-check-task') === id;
      const next = fromRow ? focusAfterToggle(list, id, done) : undefined;
      void report(actions.setTaskDone(task, done));
      if (next === undefined) return;
      focusAfterRender(
        () =>
          (next && document.querySelector<HTMLElement>(`[data-check-task="${next}"]`)) ||
          listHeadingRef.current,
      );
    },
    [findTask, list, report, focusAfterRender],
  );

  const onUpdate = useCallback(
    (id: string, changes: TaskChanges) => {
      const task = findTask(id);
      if (task) void report(actions.updateTask(task, changes));
    },
    [findTask, report],
  );

  const onSetProject = useCallback(
    (id: string, projectId: string | null) => {
      const task = findTask(id);
      if (task && tasks) void report(actions.setTaskProject(task, projectId, tasks));
    },
    [findTask, tasks, report],
  );

  const onAddSubtask = useCallback(
    (parentId: string, title: string) => {
      if (tasks) void report(actions.addTask(title, { dueDate: null, projectId: null, parentId }, tasks));
    },
    [tasks, report],
  );

  const closeDetail = useCallback(() => {
    const id = selectedId;
    setSelectedId(null);
    // Back to the row that opened it, or — if that row is gone — the list.
    focusAfterRender(
      () =>
        (id && document.querySelector<HTMLElement>(`[data-open-task="${id}"]`)) ||
        listHeadingRef.current,
    );
  }, [selectedId, focusAfterRender]);

  const onDelete = useCallback(
    (id: string) => {
      const task = findTask(id);
      if (!task || !tasks) return;
      // Deleting a subtask returns to its parent; deleting a task closes the panel.
      setSelectedId(task.parentId);
      void report(actions.deleteTask(task, tasks));
      if (task.parentId === null) focusAfterRender(() => listHeadingRef.current);
    },
    [findTask, tasks, report, focusAfterRender],
  );

  // ── Projects ──

  const onCreateProject = useCallback(
    async (name: string) => {
      if (!projects) return;
      const id = await report(actions.addProject({ name, parentId: null }, projects));
      if (id) {
        navigate({ kind: 'project', projectId: id });
        setDrawerOpen(false);
      }
    },
    [projects, report, navigate],
  );

  const currentProject =
    selection.kind === 'project' ? projects?.find((p) => p.id === selection.projectId) : undefined;

  const closeProjectEditor = useCallback(() => {
    setEditingProject(false);
    focusAfterRender(() => listHeadingRef.current);
  }, [focusAfterRender]);

  const onSaveProject = useCallback(
    (changes: ProjectChanges) => {
      if (currentProject) void report(actions.updateProject(currentProject, changes));
      closeProjectEditor();
    },
    [currentProject, report, closeProjectEditor],
  );

  const onArchiveProject = useCallback(
    (archived: boolean) => {
      if (currentProject && projects) {
        void report(actions.setProjectArchived(currentProject, archived, projects));
      }
      closeProjectEditor();
    },
    [currentProject, projects, report, closeProjectEditor],
  );

  const onDeleteProject = useCallback(() => {
    if (currentProject) void report(actions.deleteProject(currentProject));
    navigate({ kind: 'today' }, true);
  }, [currentProject, report, navigate]);

  // ── The drawer ──

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    focusAfterRender(() => menuButtonRef.current);
  }, [focusAfterRender]);

  // The drawer only exists in the narrow layout; widening the window closes it.
  useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);

  useEffect(() => {
    if (drawerOpen) drawerCloseRef.current?.focus();
  }, [drawerOpen]);

  // Escape closes whatever is on top: the drawer, then the open task.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (drawerOpen) closeDrawer();
      else if (detail) closeDetail();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, detail, closeDrawer, closeDetail]);

  const drawerShown = narrow && drawerOpen;
  const overlayShown = narrow && detail !== null;

  return (
    <div className="app">
      {(!narrow || drawerOpen) && (
        <Sidebar
          build={BUILD}
          model={sidebar}
          drawer={narrow}
          closeRef={drawerCloseRef}
          onClose={narrow ? closeDrawer : () => {}}
          onCreateProject={(name) => void onCreateProject(name)}
        />
      )}
      {drawerShown && <div className="drawer-backdrop" onClick={closeDrawer} />}

      <main className="app__main" inert={drawerShown || overlayShown}>
        {writeError && (
          <div className="write-error" role="alert">
            <p className="write-error__text">{writeError}</p>
            <button type="button" className="button" onClick={() => setWriteError(null)}>
              Dismiss
            </button>
          </div>
        )}
        <TaskListPanel
          list={list}
          fallbackTitle={FALLBACK_TITLES[selection.kind]}
          selectedId={detail?.id ?? null}
          onOpenMenu={narrow ? () => setDrawerOpen(true) : null}
          menuButtonRef={menuButtonRef}
          headingRef={listHeadingRef}
          headerActions={
            projectModel && (
              <button
                type="button"
                className="button list-panel__action"
                aria-expanded={editingProject}
                aria-controls="project-editor"
                onClick={() => (editingProject ? closeProjectEditor() : setEditingProject(true))}
              >
                Edit project
              </button>
            )
          }
          beforeList={
            projectModel && (
              <>
                {projectModel.archived && (
                  <p className="list-panel__notice">
                    This project is archived. It’s kept so its tasks can still say where they came
                    from.
                  </p>
                )}
                {editingProject && (
                  <div id="project-editor">
                    <ProjectEditor
                      key={projectModel.id}
                      model={projectModel}
                      onSave={onSaveProject}
                      onArchive={onArchiveProject}
                      onDelete={onDeleteProject}
                      onClose={closeProjectEditor}
                    />
                  </div>
                )}
              </>
            )
          }
          onAdd={onAdd}
          onToggle={onToggle}
          onOpen={setSelectedId}
        />
      </main>

      {detail ? (
        <DetailPanel
          key={detail.id}
          detail={detail}
          overlay={narrow}
          onClose={closeDetail}
          onOpen={setSelectedId}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onSetProject={onSetProject}
          onAddSubtask={onAddSubtask}
          onDelete={onDelete}
        />
      ) : (
        !narrow && <DetailPlaceholder />
      )}
    </div>
  );
}
