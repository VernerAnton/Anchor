import { useMemo, useState } from 'react';
import type { Label, Project, Recurrence, Task } from './types/task';
import type { PathEntry } from './types/path';
import type { SyncMode } from './store';
import { repository } from './store';
import {
  completeTask,
  editEntry,
  editTask,
  insertEntry,
  moveEntry,
  newTask,
  removeEntry,
  reopenTask,
  rescheduleTask,
  emptyTaskDraft,
  setEntryCleared,
  setEntryStarted,
  setTaskRecurrence,
  setWildcardTasks,
  newLabel,
  stripLabel,
  swapLabelOrder,
  toggleTaskLabel,
  type EntryChanges,
} from './store/mutations';
import { todayStr, weekdayOf } from './lib/dates';
import { buildDay, clearedCount, landingOn, pointsOf } from './lib/day';
import { regroup } from './lib/grouping';
import { sortItems } from './lib/sorting';
import { isSample, samplePattern, sampleProjects, sampleTasks } from './lib/sampleData';
import {
  buildTaskList,
  defaultDueDate,
  defaultProjectId,
  selectionKey,
  type Selection,
} from './lib/views';
import {
  useDayLogs,
  useLabels,
  usePathPattern,
  useProjects,
  useSettings,
  useTasks,
} from './hooks/useStore';
import { Sidebar } from './components/Sidebar';
import { TaskListPanel } from './components/TaskListPanel';
import { PathArea } from './components/PathArea';
import { PathLibrary } from './components/PathLibrary';
import { ExitPathMode } from './components/ExitPathMode';
import { StatusBar } from './components/StatusBar';
import { defaultSettings } from './types/settings';
import type { Settings, ViewOptions } from './types/settings';
import { defaultViewOptions } from './types/settings';
import type { ThemePreference } from './lib/theme';
import { DetailPanel } from './components/DetailPanel';
import { ProjectEditor, type ProjectEditorState } from './components/ProjectEditor';
import { LabelsPanel } from './components/LabelsPanel';
import { SyncSettings } from './components/SyncSettings';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useNow } from './hooks/useNow';
import { useTheme } from './hooks/useTheme';

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
  const labels = useLabels();
  const settings = useSettings();
  const pattern = usePathPattern();
  const logs = useDayLogs();
  const update = useAppUpdate();
  useTheme(settings?.theme ?? 'system');

  const [selection, setSelection] = useState<Selection>({ kind: 'today' });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectEditor, setProjectEditor] = useState<ProjectEditorState | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  /*
   * Which day the path is showing, or `null` while it is simply following
   * today. Up here rather than inside the path because the library beside it
   * offers what lands on that same day — one date read by two columns.
   * The null matters: a device left open overnight has to wake up on
   * the new day, and there is no way to tell "yesterday because I left it
   * open" from "yesterday because I went to look at it" by comparing dates.
   * Not having picked one is the thing worth storing.
   */
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  /*
   * Whether the week is open for changing. Deliberately not stored, unlike
   * path mode itself: path mode is a preference and should survive a restart,
   * whereas building is something you are doing right now. Reopening the app
   * tomorrow should hand you the route, not the builder you walked away from.
   */
  const [building, setBuilding] = useState(false);

  const today = todayStr();
  const pathDate = pickedDate ?? today;
  // Picking today is the same as not having picked: it follows again from here.
  const selectPathDate = (date: string) => setPickedDate(date === today ? null : date);
  const pathNow = useNow(pathDate);
  const model = useMemo(
    () => (tasks ? buildTaskList(selection, tasks, today) : null),
    [tasks, selection, today],
  );

  if (tasks === null || projects === null || model === null) {
    return <main className="app app--loading">Loading…</main>;
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  // An empty list is an answer; null only means the subscription hasn't fired.
  const labelList = labels ?? [];

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

  /*
   * Arranging a day arranges that weekday, every week — the pattern is the
   * shape of a normal week, not a diary. What belongs to one specific date is
   * only ever what happened on it, which is the day log below.
   */
  const placeOnDay = (date: string, index: number, entry: PathEntry) => {
    void repository.savePathPattern(insertEntry(pattern, weekdayOf(date), index, entry));
  };

  const moveOnDay = (date: string, from: number, to: number) => {
    void repository.savePathPattern(moveEntry(pattern, weekdayOf(date), from, to));
  };

  const takeOffDay = (date: string, entryId: string) => {
    void repository.savePathPattern(removeEntry(pattern, weekdayOf(date), entryId));
  };

  const reshapeEntry = (date: string, entryId: string, changes: EntryChanges) => {
    void repository.savePathPattern(editEntry(pattern, weekdayOf(date), entryId, changes));
  };

  /** The moment you began. Says nothing about finishing — that's the tick. */
  const startEntry = (date: string, entryId: string, started: boolean) => {
    const existing = (logs ?? []).find((l) => l.date === date) ?? null;
    void repository.saveDayLog(setEntryStarted(existing, date, entryId, started));
  };

  /** What went into a wildcard is a fact about the date, not about the week. */
  const fillWildcard = (date: string, entryId: string, taskIds: string[]) => {
    const existing = (logs ?? []).find((l) => l.date === date) ?? null;
    void repository.saveDayLog(setWildcardTasks(existing, date, entryId, taskIds));
  };

  const setRecurrence = (task: Task, recurrence: Recurrence | null) => {
    saveTask(setTaskRecurrence(task, recurrence, today));
  };

  /** Moves the task and re-phases its rule — see `rescheduleTask`. */
  const reschedule = (task: Task, date: string) => {
    saveTask(rescheduleTask(task, date));
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

  const saveLabel = (label: Label) => void repository.saveLabel(label);

  /**
   * Deleting a label takes it off every task that carried it. The alternative
   * — leaving the id behind — is a task pointing at nothing, which reads as
   * "no labels" everywhere but quietly comes back if the id is ever reused.
   */
  const addLabel = (name: string) => {
    const order = labelList.length === 0 ? 0 : Math.max(...labelList.map((l) => l.order)) + 1;
    saveLabel(newLabel(name, order));
  };

  /** Swaps with its neighbour in the shown order, which is the order stored. */
  const moveLabel = (label: Label, direction: -1 | 1) => {
    const ordered = [...labelList]
      .filter((l) => !l.archived)
      .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name)));
    const at = ordered.findIndex((l) => l.id === label.id);
    const neighbour = ordered[at + direction];
    if (!neighbour) return;
    for (const next of swapLabelOrder(label, neighbour)) saveLabel(next);
  };

  const deleteLabel = (label: Label) => {
    for (const task of tasks.filter((t) => (t.labelIds ?? []).includes(label.id))) {
      saveTask(stripLabel(task, label.id));
    }
    void repository.deleteLabel(label.id);
    if (selection.kind === 'label' && selection.labelId === label.id) {
      select({ kind: 'today' });
    }
  };

  /**
   * Switching sides is a stored setting, not navigation — it survives a
   * restart and reaches your other devices, so the app opens where you left
   * it rather than asking again every morning.
   */
  const saveSetting = (changes: Partial<Pick<Settings, 'pathMode' | 'theme' | 'views'>>) => {
    const base = settings ?? defaultSettings();
    void repository.saveSettings({
      ...base,
      ...changes,
      version: base.version + 1,
      updatedAt: Date.now(),
    });
  };

  /*
   * How this view arranges itself, and how a change to it is written back.
   * Views that were never touched carry no entry at all.
   */
  const viewKey = selectionKey(selection);
  const viewOptions = settings?.views?.[viewKey] ?? defaultViewOptions();
  const setViewOptions = (changes: Partial<ViewOptions>) =>
    saveSetting({
      views: { ...(settings?.views ?? {}), [viewKey]: { ...viewOptions, ...changes } },
    });

  /*
   * Grouping is a second cut, and only some views want one. Upcoming is
   * already a section per date and grouping would nest a project inside a day;
   * a project's own list is already the answer to "group by project", and a
   * label's to grouping by label. Sorting, by contrast, has something to say
   * inside every list there is.
   */
  const groupable = selection.kind === 'today' || selection.kind === 'all';

  const setPathMode = (pathMode: boolean) => {
    saveSetting({ pathMode });
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
      labels={labelList}
      onToggleLabel={(task, labelId) => saveTask(toggleTaskLabel(task, labelId))}
      tasks={tasks}
      projects={projects}
      today={today}
      onClose={() => setSelectedTaskId(null)}
      onUpdate={updateTask}
      onSetRecurrence={setRecurrence}
      onReschedule={reschedule}
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
      <div className={building ? 'app app--path app--framed app--building' : 'app app--path app--framed'}>
        <PathArea
          building={building}
          onSetBuilding={setBuilding}
          tasks={tasks}
          projects={projects}
          today={today}
          date={pathDate}
          onSelectDate={selectPathDate}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          pattern={pattern}
          logs={logs ?? []}
          onClearEntry={clearEntry}
          onStartEntry={startEntry}
          now={pathNow}
          onInsertEntry={placeOnDay}
          onMoveEntry={moveOnDay}
          onRemoveEntry={takeOffDay}
          onEditEntry={reshapeEntry}
          onFillWildcard={fillWildcard}
        />

        {/*
          * Only while building. Outside it there is nothing to drag from and
          * nothing to file, and the route reads better with the screen to
          * itself — a timeline doesn't improve by being squeezed next to a
          * list you aren't using.
          */}
        {building && (
        <PathLibrary
          projects={projects}
          landing={landingOn(tasks, pattern, pathDate)}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          /*
           * Dated to the day being built. This list is what lands on that day,
           * so a task typed into it that didn't land there would vanish the
           * moment you finished typing. It still isn't *placed* — dating it
           * makes it available to the day, and putting it in a position is
           * still something you do on the path.
           */
          onAddTask={(title, projectId) => addTask(title, { projectId, dueDate: pathDate })}
          onNewProject={() => setProjectEditor({ mode: 'new', parentId: null })}
        />
        )}

        {detailPanel}

        <ExitPathMode
          onExit={() => {
            setBuilding(false);
            setPathMode(false);
          }}
        />

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
          date={pathDate}
          onSelectDate={selectPathDate}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          pattern={pattern}
          logs={logs ?? []}
          onClearEntry={clearEntry}
          onStartEntry={startEntry}
          now={pathNow}
          onInsertEntry={placeOnDay}
          onMoveEntry={moveOnDay}
          onRemoveEntry={takeOffDay}
          onEditEntry={reshapeEntry}
          onFillWildcard={fillWildcard}
          /* A view of the route, not a builder. Building has a place of its
             own, and the button in this panel's header is how you get there. */
          building={false}
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
      ) : selection.kind === 'labels' ? (
        <LabelsPanel
          labels={labelList}
          tasks={tasks}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpen={(labelId) => select({ kind: 'label', labelId })}
          onAdd={addLabel}
          onSave={saveLabel}
          onDelete={deleteLabel}
          onMove={moveLabel}
        />
      ) : (
        <TaskListPanel
          selection={selection}
          /*
           * Grouping is a second cut through rows the view already chose. It
           * applies where a list is otherwise flat or date-sectioned; the date
           * sections a view considers structural — Today's "Earlier" — survive
           * it, because overdue is a fact about the date rather than about
           * which project something is filed under.
           */
          model={{
            ...model,
            /*
             * Group first, then sort inside each group. The other way round
             * would sort a list that is about to be cut up, which is work
             * thrown away — and the order that matters is the one you read
             * down a section, not the one the rows had before they were split.
             */
            sections: (groupable
              ? regroup(model.sections, viewOptions.groupBy, projects, labelList)
              : model.sections
            ).map((section) => ({
              ...section,
              items: sortItems(section.items, viewOptions.sortBy, viewOptions.reverse),
            })),
          }}
          projects={projects}
          labels={labelList}
          today={today}
          selectedTaskId={selectedTaskId}
          onOpenDrawer={() => setDrawerOpen(true)}
          onSelectTask={setSelectedTaskId}
          onToggleTask={toggleTask}
          onAddTask={addTask}
          grouping={groupable ? viewOptions.groupBy : undefined}
          onSetGrouping={groupable ? (groupBy) => setViewOptions({ groupBy }) : undefined}
          sortBy={viewOptions.sortBy}
          reverse={viewOptions.reverse}
          onSetSort={(sortBy) => setViewOptions({ sortBy })}
          onToggleReverse={() => setViewOptions({ reverse: !viewOptions.reverse })}
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
          theme={settings?.theme ?? 'system'}
          onSetTheme={(theme: ThemePreference) => saveSetting({ theme })}
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
