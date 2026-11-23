import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectColor, Recurrence } from './types/task';
import type { ViewOptions } from './types/settings';
import { useLabels, useProjects, useSettings, useTasks } from './hooks/useStore';
import { useNarrowLayout } from './hooks/useNarrowLayout';
import { useFocusAfterRender } from './hooks/useFocusAfterRender';
import { useSelection } from './hooks/useSelection';
import { useToday } from './hooks/useToday';
import { useSyncStatus } from './hooks/useSyncStatus';
import { useTheme } from './hooks/useTheme';
import { useAppUpdate } from './hooks/useAppUpdate';
import { buildList, completionNotice, focusAfterToggle, labelsScreen, taskDetail } from './lib/views';
import { sidebarModel } from './lib/sidebar';
import { projectEditorModel } from './lib/projects';
import { isListSelection, viewKey } from './lib/selection';
import { syncStatusText } from './lib/sync';
import { countSamples } from './lib/sampleData';
import { hasFirebaseConfig } from './store/firebaseConfig';
import { repository, syncMode } from './store';
import { buildInfo } from './lib/build';
import * as actions from './store/actions';
import { Sidebar } from './components/Sidebar';
import { TaskListPanel } from './components/TaskListPanel';
import { DetailPanel, DetailPlaceholder, type TaskChanges } from './components/DetailPanel';
import { ProjectEditor, type ProjectChanges } from './components/ProjectEditor';
import { LabelsScreen } from './components/LabelsScreen';
import { Notice, type NoticeModel } from './components/Notice';
import { SettingsScreen } from './components/SettingsScreen';
import { UpdatePrompt } from './components/UpdatePrompt';
import { SampleNotice } from './components/SampleNotice';

const BUILD = buildInfo();

/** Plain and blameless: the device failed a write, the person did nothing wrong. */
const WRITE_ERROR = 'That change couldn’t be saved on this device. Your other tasks are unaffected.';

const FALLBACK_TITLES = {
  today: 'Today',
  upcoming: 'Upcoming',
  all: 'All tasks',
  project: 'Project',
  label: 'Label',
  labels: 'Labels',
  settings: 'Settings',
};

/** A write the cloud refused after this device had already shown it. Plain, and says what to do. */
const CLOUD_WRITE_ERROR =
  'A recent change didn’t reach the cloud. It’s still on this device — check that the sync key matches the one in your Firestore rules.';

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
  const labels = useLabels();
  const settings = useSettings();
  const today = useToday();
  const syncStatus = useSyncStatus();
  const update = useAppUpdate();
  const [samplesHidden, setSamplesHidden] = useState(false);
  useTheme(settings?.theme ?? 'system');
  const narrow = useNarrowLayout();
  const [selection, navigate] = useSelection();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeModel | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRender = useFocusAfterRender();
  // The latest tasks, for callbacks that run after later writes have landed (Undo).
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const listSelection = isListSelection(selection) ? selection : null;
  const loaded = tasks !== null && projects !== null && labels !== null && settings !== undefined;

  const list = useMemo(() => {
    if (!loaded || !listSelection) return null;
    const options = settings?.views[viewKey(listSelection)];
    return buildList({ selection: listSelection, tasks, projects, labels, today, options });
  }, [loaded, listSelection, tasks, projects, labels, settings, today]);
  const sidebar = useMemo(
    () => sidebarModel(selection, tasks ?? [], projects ?? [], labels ?? [], today),
    [selection, tasks, projects, labels, today],
  );
  const detail = useMemo(
    () =>
      taskDetail({ tasks: tasks ?? [], projects: projects ?? [], labels: labels ?? [], today }, selectedId),
    [tasks, projects, labels, today, selectedId],
  );
  const projectModel = useMemo(
    () =>
      selection.kind === 'project'
        ? projectEditorModel(selection.projectId, projects ?? [], tasks ?? [])
        : null,
    [selection, projects, tasks],
  );
  const labelRows = useMemo(() => labelsScreen(labels ?? [], tasks ?? []), [labels, tasks]);

  // A project or label that no longer exists isn't a place to be; fall back to Today.
  useEffect(() => {
    const goneProject = selection.kind === 'project' && projects !== null && projectModel === null;
    const goneLabel =
      selection.kind === 'label' && labels !== null && !labels.some((l) => l.id === selection.labelId);
    if (goneProject || goneLabel) navigate({ kind: 'today' }, true);
  }, [selection, projects, projectModel, labels, navigate]);

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
  const findLabel = useCallback((id: string) => labels?.find((label) => label.id === id), [labels]);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // A write the cloud refused after accepting it locally.
  useEffect(() => repository.subscribeWriteErrors(() => setWriteError(CLOUD_WRITE_ERROR)), []);

  /*
   * First run: an install with nothing in it gets sample tasks, so it isn't a
   * blank screen. Only here on this device — a shared cloud store is never
   * seeded — and only once: the settings document written alongside marks the
   * install as set up, so clearing the samples is final.
   */
  const firstRunDone = useRef(false);
  useEffect(() => {
    if (firstRunDone.current || !loaded || settings !== null) return;
    firstRunDone.current = true;
    const empty = tasks.length === 0 && projects.length === 0 && labels.length === 0;
    void report(
      (async () => {
        if (empty && syncMode === 'local') await actions.loadSamples();
        await actions.markInitialised(null);
      })(),
    );
  }, [loaded, settings, tasks, projects, labels, report]);

  const sampleCount = useMemo(
    () => countSamples(tasks ?? [], projects ?? [], labels ?? []),
    [tasks, projects, labels],
  );

  // ── Tasks ──

  const onAdd = useCallback(
    (title: string) => {
      if (!tasks || !list) return;
      const { dueDate, projectId, labelIds } = list.quickAdd;
      void report(actions.addTask(title, { dueDate, projectId, parentId: null, labelIds }, tasks));
    },
    [tasks, list, report],
  );

  const onToggle = useCallback(
    (id: string, done: boolean) => {
      const task = findTask(id);
      if (!task) return;
      // Only a toggle made from a list row moves focus — the row is about to
      // move and would take focus with it.
      const fromRow = list && document.activeElement?.getAttribute('data-check-task') === id;
      const next = fromRow ? focusAfterToggle(list, id, done) : undefined;
      // A repeating task moves on instead of closing; say where it went, and
      // offer the way back, because the tick undoes itself on screen.
      const moved = done ? completionNotice(task, today) : null;
      void report(actions.setTaskDone(task, done)).then((before) => {
        if (moved && before) {
          setNotice({
            text: moved,
            undo: () => {
              const current = tasksRef.current?.find((t) => t.id === id);
              void report(actions.restoreTask(before, current ?? before));
            },
          });
        }
      });
      if (next === undefined) return;
      focusAfterRender(
        () =>
          (next && document.querySelector<HTMLElement>(`[data-check-task="${next}"]`)) ||
          listHeadingRef.current,
      );
    },
    [findTask, list, today, report, focusAfterRender],
  );

  /** Runs an action against the current copy of a task, if it still exists. */
  const withTask = useCallback(
    (id: string, run: (task: NonNullable<ReturnType<typeof findTask>>) => Promise<unknown>) => {
      const task = findTask(id);
      if (task) void report(run(task));
    },
    [findTask, report],
  );

  const onUpdate = useCallback(
    (id: string, changes: TaskChanges) => withTask(id, (task) => actions.updateTask(task, changes)),
    [withTask],
  );
  const onSetProject = useCallback(
    (id: string, projectId: string | null) =>
      withTask(id, (task) => actions.setTaskProject(task, projectId, tasks ?? [])),
    [withTask, tasks],
  );
  const onReschedule = useCallback(
    (id: string, date: string) => withTask(id, (task) => actions.rescheduleTo(task, date)),
    [withTask],
  );
  const onSetRecurrence = useCallback(
    (id: string, rule: Recurrence | null) => withTask(id, (task) => actions.setRecurrence(task, rule)),
    [withTask],
  );
  const onAddLabelNames = useCallback(
    (id: string, names: string[]) =>
      withTask(id, (task) => actions.addLabelsByName(task, names, labels ?? [])),
    [withTask, labels],
  );
  const onAddLabel = useCallback(
    (id: string, labelId: string) => withTask(id, (task) => actions.addLabelById(task, labelId)),
    [withTask],
  );
  const onRemoveLabel = useCallback(
    (id: string, labelId: string) => withTask(id, (task) => actions.removeLabel(task, labelId)),
    [withTask],
  );

  const onAddSubtask = useCallback(
    (parentId: string, title: string) => {
      if (tasks) {
        void report(
          actions.addTask(title, { dueDate: null, projectId: null, parentId, labelIds: [] }, tasks),
        );
      }
    },
    [tasks, report],
  );

  const onMove = useCallback(
    (shown: string[], id: string, toIndex: number) => {
      if (!tasks || !list) return;
      const byId = new Map(tasks.map((t) => [t.id, t]));
      const ordered = shown.flatMap((sid) => {
        const t = byId.get(sid);
        return t ? [{ id: sid, order: t.order }] : [];
      });
      void report(actions.moveTask(ordered, id, toIndex, list.options.reverse, tasks));
    },
    [tasks, list, report],
  );

  const onOptions = useCallback(
    (changes: Partial<ViewOptions>) => {
      if (listSelection && settings !== undefined) {
        void report(actions.setViewOptions(settings, viewKey(listSelection), changes));
      }
    },
    [listSelection, settings, report],
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

  // ── Labels ──

  const onCreateLabel = useCallback(
    (name: string) => {
      if (labels) void report(actions.createLabel(name, labels));
    },
    [labels, report],
  );
  const onRenameLabel = useCallback(
    (id: string, name: string) => {
      const label = findLabel(id);
      if (label) void report(actions.updateLabel(label, { name }));
    },
    [findLabel, report],
  );
  const onRecolorLabel = useCallback(
    (id: string, colorId: ProjectColor) => {
      const label = findLabel(id);
      if (label) void report(actions.updateLabel(label, { colorId }));
    },
    [findLabel, report],
  );
  const onSwapLabels = useCallback(
    (id: string, withId: string) => {
      const a = findLabel(id);
      const b = findLabel(withId);
      if (a && b) void report(actions.swapLabels(a, b));
    },
    [findLabel, report],
  );
  const onDeleteLabel = useCallback(
    (id: string) => {
      const label = findLabel(id);
      if (label && tasks) void report(actions.deleteLabel(label, tasks));
    },
    [findLabel, tasks, report],
  );

  const onClearSamples = useCallback(() => {
    if (tasks && projects && labels) {
      setSelectedId(null);
      void report(actions.clearSamples(tasks, projects, labels));
    }
  }, [tasks, projects, labels, report]);

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
  const openMenu = narrow ? () => setDrawerOpen(true) : null;

  return (
    <div className="app">
      {(!narrow || drawerOpen) && (
        <Sidebar
          build={BUILD}
          model={sidebar}
          syncText={syncStatusText(syncStatus).short}
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
        {update.needRefresh && <UpdatePrompt onReload={update.updateApp} onDismiss={update.dismiss} />}
        {notice && <Notice notice={notice} onDismiss={dismissNotice} />}

        {selection.kind === 'settings' ? (
          <SettingsScreen
            cloudAvailable={hasFirebaseConfig()}
            connected={syncMode === 'cloud'}
            statusText={syncStatusText(syncStatus).long}
            theme={settings?.theme ?? 'system'}
            sampleCount={sampleCount}
            build={BUILD}
            onOpenMenu={openMenu}
            menuButtonRef={menuButtonRef}
            headingRef={listHeadingRef}
            onTheme={(theme) => {
              if (settings !== undefined) void report(actions.setThemePreference(settings, theme));
            }}
            onConnect={actions.connectSync}
            onDisconnect={actions.disconnectSync}
            onLoadSamples={() => void report(actions.loadSamples())}
            onClearSamples={onClearSamples}
          />
        ) : selection.kind === 'labels' ? (
          <LabelsScreen
            rows={labelRows}
            onOpenMenu={openMenu}
            menuButtonRef={menuButtonRef}
            headingRef={listHeadingRef}
            onCreate={onCreateLabel}
            onRename={onRenameLabel}
            onRecolor={onRecolorLabel}
            onSwap={onSwapLabels}
            onDelete={onDeleteLabel}
          />
        ) : (
          <TaskListPanel
            list={list}
            fallbackTitle={FALLBACK_TITLES[selection.kind]}
            selectedId={detail?.id ?? null}
            onOpenMenu={openMenu}
            menuButtonRef={menuButtonRef}
            headingRef={listHeadingRef}
            notices={
              sampleCount > 0 &&
              !samplesHidden && (
                <SampleNotice onClear={onClearSamples} onHide={() => setSamplesHidden(true)} />
              )
            }
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
                      This project is archived. It’s kept so its tasks can still say where they
                      came from.
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
            onMove={onMove}
            onOptions={onOptions}
          />
        )}
      </main>

      {detail ? (
        <DetailPanel
          key={detail.id}
          detail={detail}
          labels={labels ?? []}
          overlay={narrow}
          onClose={closeDetail}
          onOpen={setSelectedId}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onSetProject={onSetProject}
          onReschedule={onReschedule}
          onSetRecurrence={onSetRecurrence}
          onAddLabelNames={onAddLabelNames}
          onAddLabel={onAddLabel}
          onRemoveLabel={onRemoveLabel}
          onAddSubtask={onAddSubtask}
          onDelete={onDelete}
        />
      ) : (
        !narrow && <DetailPlaceholder />
      )}
    </div>
  );
}
