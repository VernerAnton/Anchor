import { useMemo, useState } from 'react';
import type { Project, Recurrence, Task } from './types/task';
import type { SyncMode } from './store';
import { repository } from './store';
import {
  completeTask,
  editTask,
  newTask,
  reopenTask,
  emptyTaskDraft,
  setEntryCleared,
  setTaskRecurrence,
} from './store/mutations';
import { todayStr } from './lib/dates';
import { buildDay, clearedCount, pointsOf } from './lib/day';
import { isSample, samplePattern, sampleProjects, sampleTasks } from './lib/sampleData';
import {
  buildTaskList,
  defaultDueDate,
  defaultProjectId,
  selectionKey,
  type Selection,
} from './lib/views';
import { useDayLogs, usePathPattern, useProjects, useSettings, useTasks } from './hooks/useStore';
import { Sidebar } from './components/Sidebar';
import { TaskListPanel } from './components/TaskListPanel';
import { PathArea } from './components/PathArea';
import { PathLibrary } from './components/PathLibrary';
import { ExitPathMode } from './components/ExitPathMode';
import { StatusBar } from './components/StatusBar';
import { defaultSettings } from './types/settings';
import { DetailPanel } from './components/DetailPanel';
import { ProjectEditor, type ProjectEditorState } from './components/ProjectEditor';
import { SyncSettings } from './components/SyncSettings';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAppUpdate } from './hooks/useAppUpdate';

interface Props {
  syncMode: SyncMode;
}

/**
 * The build area: sidebar (views + projects), task list, detail panel.
 * Wide-screen first; below the collapse breakpoint the sidebar becomes a
 * drawer and the detail panel an overlay.
 *
 * All writes go through here: components below are handed data and callbacks,
 * so the repository and the mutation rules stay in one place.
 */
export function App({ syncMode }: Props) {
  const tasks = useTasks();
  const projects = useProjects();
  const settings = useSettings();
  const pattern = usePathPattern();
  const logs = useDayLogs();
  const update = useAppUpdate();

  const [selection, setSelection] = useState<Selection>({ kind: 'today' });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectEditor, setProjectEditor] = useState<ProjectEditorState | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const today = todayStr();
  const model = useMemo(
    () => (tasks ? buildTaskList(selection, tasks, today) : null),
    [tasks, selection, today],
  );

  if (tasks === null || projects === null || model === null) {
    return <main className="app app--loading">Loading…</main>;
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const select = (next: Selection) => {
    setSelection(next);
    setSelectedTaskId(null);
    setDrawerOpen(false);
  };

  const saveTask = (task: Task) => void repository.saveTask(task);

  const toggleTask = (task: Task) => {
    saveTask(
      task.completedAt === null ? completeTask(task, Date.now(), today) : reopenTask(task),
    );
  };

  /**
   * Anything left out is inferred from the current view, which is how the
   * plain quick-add has always worked. Callers pass a field explicitly when
   * the place you typed already answers it — the per-project rows in path
   * mode say which project, and say nothing about when.
   */
  const addTask = (
    title: string,
    overrides: { projectId?: string | null; dueDate?: string | null } = {},
  ) => {
    const order = tasks.length === 0 ? 0 : Math.max(...tasks.map((t) => t.order)) + 1;
    const task = newTask(
      {
        ...emptyTaskDraft(),
        title,
        dueDate: overrides.dueDate !== undefined ? overrides.dueDate : defaultDueDate(selection, today),
        projectId:
          overrides.projectId !== undefined ? overrides.projectId : defaultProjectId(selection),
      },
      order,
    );
    saveTask(task);
    // Open the new task straight away, so date, priority and recurrence can be
    // set without hunting for the row you just created. On mobile this is what
    // slides the detail overlay in — `.detail--open` keys off a selected task,
    // so one line covers both layouts.
    setSelectedTaskId(task.id);
  };

  const addSubtask = (parent: Task, title: string) => {
    const order = tasks.length === 0 ? 0 : Math.max(...tasks.map((t) => t.order)) + 1;
    saveTask(
      newTask(
        { ...emptyTaskDraft(), title, parentId: parent.id, projectId: parent.projectId },
        order,
      ),
    );
  };

  const updateTask = (task: Task, changes: Parameters<typeof editTask>[1]) => {
    saveTask(editTask(task, changes));
  };

  /**
   * Ticking a point on the path records that *placement*, on that date — not
   * the task. Two placements of one task clear independently.
   */
  const clearEntry = (date: string, entryId: string, cleared: boolean) => {
    const existing = (logs ?? []).find((l) => l.date === date) ?? null;
    void repository.saveDayLog(setEntryCleared(existing, date, entryId, cleared));
  };

  const setRecurrence = (task: Task, recurrence: Recurrence | null) => {
    saveTask(setTaskRecurrence(task, recurrence, today));
  };

  const deleteTask = (task: Task) => {
    // Subtasks go with their parent — an orphaned subtask has no home to show in.
    for (const sub of tasks.filter((t) => t.parentId === task.id)) {
      void repository.deleteTask(sub.id);
    }
    void repository.deleteTask(task.id);
    if (selectedTaskId === task.id) setSelectedTaskId(null);
  };

  const saveProject = (project: Project) => void repository.saveProject(project);

  /**
   * Switching sides is a stored setting, not navigation — it survives a
   * restart and reaches your other devices, so the app opens where you left
   * it rather than asking again every morning.
   */
  const setPathMode = (pathMode: boolean) => {
    const base = settings ?? defaultSettings();
    void repository.saveSettings({
      ...base,
      pathMode,
      version: base.version + 1,
      updatedAt: Date.now(),
    });
    setSelectedTaskId(null);
  };

  const samples = [
    ...tasks.filter((t) => isSample(t.id)),
    ...projects.filter((p) => isSample(p.id)),
  ];

  /**
   * Written straight through the repository rather than the usual mutations,
   * because these documents arrive complete — there is no draft being edited
   * and nothing to version-bump against.
   */
  const loadSamples = async () => {
    await Promise.all(sampleProjects().map((p) => repository.saveProject(p)));
    await Promise.all(sampleTasks(today).map((t) => repository.saveTask(t)));
    await repository.savePathPattern(samplePattern());
  };

  const clearSamples = async () => {
    await Promise.all(tasks.filter((t) => isSample(t.id)).map((t) => repository.deleteTask(t.id)));
    await Promise.all(
      projects.filter((p) => isSample(p.id)).map((p) => repository.deleteProject(p.id)),
    );
    // The pattern is a single document, so clearing samples empties it rather
    // than deleting it — anything you arranged yourself would be in here too.
    const live = pattern
      ? Object.fromEntries(
          Object.entries(pattern.days).map(([day, entries]) => [
            day,
            entries.filter((e) => !isSample(e.id)),
          ]),
        )
      : {};
    await repository.savePathPattern({
      ...(pattern ?? { schemaVersion: 1, version: 0, updatedAt: 0 }),
      days: live,
      version: (pattern?.version ?? 0) + 1,
      updatedAt: Date.now(),
    });
    if (selectedTaskId !== null && isSample(selectedTaskId)) setSelectedTaskId(null);
  };

  const deleteProject = (project: Project) => {
    // Its tasks live on, unfiled — deleting a folder shouldn't delete the work.
    for (const task of tasks.filter((t) => t.projectId === project.id)) {
      saveTask(editTask(task, { projectId: null }));
    }
    for (const child of projects.filter((p) => p.parentId === project.id)) {
      void repository.saveProject({ ...child, parentId: null });
    }
    void repository.deleteProject(project.id);
    if (selection.kind === 'project' && selection.projectId === project.id) {
      select({ kind: 'today' });
    }
  };

  /*
   * The readout counts today's path, not the library. "Cleared 2 / 11" is a
   * statement about the day in front of you; the same fraction over every live
   * task in the app counts a backlog you were never going to finish today, and
   * so only ever reads as failure.
   */
  const todaySegments = buildDay(
    tasks,
    pattern,
    (logs ?? []).find((l) => l.date === today) ?? null,
    today,
  );
  const todayPoints = pointsOf(todaySegments);
  const statusBar = (
    <StatusBar
      today={today}
      syncMode={syncMode}
      cleared={clearedCount(todaySegments)}
      total={todayPoints.length}
    />
  );

  const detailPanel = (
    <DetailPanel
      task={selectedTask}
      tasks={tasks}
      projects={projects}
      today={today}
      onClose={() => setSelectedTaskId(null)}
      onUpdate={updateTask}
      onSetRecurrence={setRecurrence}
      onToggle={toggleTask}
      onDelete={deleteTask}
      onAddSubtask={addSubtask}
      onSelectTask={setSelectedTaskId}
    />
  );

  /**
   * Path mode takes the whole screen. No sidebar, no views list, no project
   * tree — the projects come back as the sections of the library on the right,
   * and the left of the screen belongs entirely to the day. The only way back
   * is the exit in the corner, deliberately small.
   */
  if (settings?.pathMode === true) {
    return (
      <>
      {statusBar}
      <div className="app app--path app--framed">
        <PathArea
          tasks={tasks}
          projects={projects}
          today={today}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          pattern={pattern}
          logs={logs ?? []}
          onToggleTask={toggleTask}
          onClearEntry={clearEntry}
        />

        <PathLibrary
          tasks={tasks}
          projects={projects}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          /*
           * Filed, but not scheduled. The library is every task you have,
           * not today's route — typing into the Health section says where
           * this belongs, not when you'll do it. Putting it on a day is the
           * day editor's job, and silently dating it today would drop things
           * onto the path that you never chose to put there.
           */
          onAddTask={(title, projectId) => addTask(title, { projectId, dueDate: null })}
          onNewProject={() => setProjectEditor({ mode: 'new', parentId: null })}
        />

        {detailPanel}

        <ExitPathMode onExit={() => setPathMode(false)} />

        {/* Path mode hides the sidebar, so this is the only way to make a
            project while you're in here. Same editor as the to-do side. */}
        {projectEditor && (
          <ProjectEditor
            state={projectEditor}
            projects={projects}
            onSave={saveProject}
            onDelete={deleteProject}
            onClose={() => setProjectEditor(null)}
          />
        )}

        {update.needRefresh && (
          <UpdatePrompt onReload={update.updateApp} onDismiss={update.dismiss} />
        )}
      </div>
      </>
    );
  }

  return (
    <>
    {statusBar}
    <div className="app app--framed" data-selection={selectionKey(selection)}>
      <Sidebar
        open={drawerOpen}
        selection={selection}
        tasks={tasks}
        projects={projects}
        today={today}
        onSelect={select}
        onNewProject={(parentId) => setProjectEditor({ mode: 'new', parentId })}
        onEditProject={(project) => setProjectEditor({ mode: 'edit', project })}
        onOpenSync={() => setSyncOpen(true)}
        syncMode={syncMode}
      />

      {selection.kind === 'path' ? (
        <PathArea
          tasks={tasks}
          projects={projects}
          today={today}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          pattern={pattern}
          logs={logs ?? []}
          onToggleTask={toggleTask}
          onClearEntry={clearEntry}
          onOpenDrawer={() => setDrawerOpen(true)}
          header={
            <header className="panel-header">
              <button
                type="button"
                className="drawer-button"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
              >
                ☰
              </button>
              <h1>Path</h1>
              <button type="button" className="btn btn--primary" onClick={() => setPathMode(true)}>
                Turn on path mode
              </button>
            </header>
          }
        />
      ) : (
        <TaskListPanel
          selection={selection}
          model={model}
          projects={projects}
          today={today}
          selectedTaskId={selectedTaskId}
          onOpenDrawer={() => setDrawerOpen(true)}
          onSelectTask={setSelectedTaskId}
          onToggleTask={toggleTask}
          onAddTask={addTask}
        />
      )}

      {detailPanel}

      {drawerOpen && (
        <button
          type="button"
          className="backdrop"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {projectEditor && (
        <ProjectEditor
          state={projectEditor}
          projects={projects}
          onSave={saveProject}
          onDelete={deleteProject}
          onClose={() => setProjectEditor(null)}
        />
      )}

      {syncOpen && (
        <SyncSettings
          mode={syncMode}
          sampleCount={samples.length}
          onLoadSamples={loadSamples}
          onClearSamples={clearSamples}
          onClose={() => setSyncOpen(false)}
        />
      )}

      {update.needRefresh && (
        <UpdatePrompt onReload={update.updateApp} onDismiss={update.dismiss} />
      )}
    </div>
    </>
  );
}
