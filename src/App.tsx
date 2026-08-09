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
  setTaskRecurrence,
} from './store/mutations';
import { todayStr } from './lib/dates';
import {
  buildTaskList,
  defaultDueDate,
  defaultProjectId,
  selectionKey,
  type Selection,
} from './lib/views';
import { useProjects, useTasks } from './hooks/useStore';
import { Sidebar } from './components/Sidebar';
import { TaskListPanel } from './components/TaskListPanel';
import { PathOverview } from './components/PathOverview';
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

  const addTask = (title: string) => {
    const order = tasks.length === 0 ? 0 : Math.max(...tasks.map((t) => t.order)) + 1;
    const task = newTask(
      {
        ...emptyTaskDraft(),
        title,
        dueDate: defaultDueDate(selection, today),
        projectId: defaultProjectId(selection),
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

  return (
    <div className="app" data-selection={selectionKey(selection)}>
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
        <PathOverview
          tasks={tasks}
          projects={projects}
          today={today}
          onOpenDrawer={() => setDrawerOpen(true)}
          onSelectTask={setSelectedTaskId}
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

      {syncOpen && <SyncSettings mode={syncMode} onClose={() => setSyncOpen(false)} />}

      {update.needRefresh && (
        <UpdatePrompt onReload={update.updateApp} onDismiss={update.dismiss} />
      )}
    </div>
  );
}
