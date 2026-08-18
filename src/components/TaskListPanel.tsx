import { useState } from 'react';
import type { Label, Project, Task } from '../types/task';
import { dateLabel, type Selection, type TaskListModel } from '../lib/views';
import { GROUP_BY_OPTIONS, type GroupBy } from '../lib/grouping';
import { SORT_OPTIONS, type SortBy } from '../lib/sorting';
import { TaskRow } from './TaskRow';

interface Props {
  selection: Selection;
  model: TaskListModel;
  projects: Project[];
  labels: Label[];
  today: string;
  selectedTaskId: string | null;
  onOpenDrawer: () => void;
  onSelectTask: (id: string) => void;
  onToggleTask: (task: Task) => void;
  onAddTask: (title: string) => void;
  /**
   * Present only on the views a grouping applies to. Today's date sections and
   * Upcoming's are the view's own arrangement; a project or a label is a
   * second cut through the same rows.
   */
  grouping?: GroupBy;
  onSetGrouping?: (grouping: GroupBy) => void;
  /** Sorting has something to say inside every list, so it is never absent. */
  sortBy: SortBy;
  reverse: boolean;
  onSetSort: (sortBy: SortBy) => void;
  onToggleReverse: () => void;
}

function panelTitle(selection: Selection, projects: Project[], labels: Label[]): string {
  switch (selection.kind) {
    case 'today':
      return 'Today';
    case 'upcoming':
      return 'Upcoming';
    case 'all':
      return 'All tasks';
    case 'path':
      return 'Path';
    case 'project':
      return projects.find((p) => p.id === selection.projectId)?.name ?? 'Project';
    case 'label':
      return labels.find((l) => l.id === selection.labelId)?.name ?? 'Label';
    case 'labels':
      return 'Labels';
  }
}

export function TaskListPanel({
  selection,
  model,
  projects,
  labels,
  today,
  selectedTaskId,
  onOpenDrawer,
  onSelectTask,
  onToggleTask,
  onAddTask,
  grouping,
  onSetGrouping,
  sortBy,
  reverse,
  onSetSort,
  onToggleReverse,
}: Props) {
  const [draft, setDraft] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onAddTask(title);
    setDraft('');
  };

  const empty =
    model.sections.every((s) => s.items.length === 0) && model.completed.length === 0;

  return (
    <main className="task-panel">
      <header className="panel-header">
        <button type="button" className="drawer-button" aria-label="Open menu" onClick={onOpenDrawer}>
          ☰
        </button>
        <h1>{panelTitle(selection, projects, labels)}</h1>
        {/*
          Top right, where a view's own controls belong. A select rather than
          a row of buttons: three options that are mutually exclusive and read
          rarely, which is exactly the shape a select is for.
        */}
        <div className="panel-header__options">
          {grouping !== undefined && onSetGrouping && (
            <label className="panel-header__group">
              <span className="visually-hidden">Group by</span>
              <select
                value={grouping}
                onChange={(event) => onSetGrouping(event.target.value as GroupBy)}
                aria-label="Group by"
              >
                {GROUP_BY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    Group: {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="panel-header__group">
            <span className="visually-hidden">Sort by</span>
            <select
              value={sortBy}
              onChange={(event) => onSetSort(event.target.value as SortBy)}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* Reads the same order from the bottom. A toggle rather than two
              more entries in the list above: reversing is a thing you do to
              whichever sort you picked, not a sort of its own. */}
          <button
            type="button"
            className="panel-header__reverse"
            aria-pressed={reverse}
            aria-label={reverse ? 'Sorting reversed' : 'Reverse the sort'}
            title={reverse ? 'Reversed' : 'Reverse'}
            onClick={onToggleReverse}
          >
            {reverse ? '↑' : '↓'}
          </button>
        </div>
      </header>

      <form className="quick-add" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a task"
          aria-label="New task title"
        />
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>

      <div className="task-sections">
        {model.sections.map((section) => (
          <section key={section.key} className="task-section">
            {section.title !== null && <h2 className="section-title">{section.title}</h2>}
            {section.items.length === 0 ? (
              section.title === 'Today' && <p className="section-empty">Nothing due today.</p>
            ) : (
              <ul className="task-list">
                {section.items.map(({ task, subtasks }) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    subtasks={subtasks}
                    projects={projects}
              labels={labels}
                    selection={selection}
                    today={today}
                    selectedTaskId={selectedTaskId}
                    onSelect={onSelectTask}
                    onToggle={onToggleTask}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}

        {empty && selection.kind !== 'today' && (
          <p className="section-empty">Nothing here yet.</p>
        )}

        {model.completed.length > 0 && (
          <details className="completed-block">
            <summary>
              {selection.kind === 'today' ? 'Done today' : 'Done'} · {model.completed.length}
            </summary>
            <ul className="task-list">
              {model.completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  subtasks={[]}
                  projects={projects}
              labels={labels}
                  selection={selection}
                  today={today}
                  selectedTaskId={selectedTaskId}
                  onSelect={onSelectTask}
                  onToggle={onToggleTask}
                />
              ))}
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}

export { dateLabel };
