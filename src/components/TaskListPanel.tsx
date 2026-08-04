import { useState } from 'react';
import type { Project, Task } from '../types/task';
import { dateLabel, type Selection, type TaskListModel } from '../lib/views';
import { TaskRow } from './TaskRow';

interface Props {
  selection: Selection;
  model: TaskListModel;
  projects: Project[];
  today: string;
  selectedTaskId: string | null;
  onOpenDrawer: () => void;
  onSelectTask: (id: string) => void;
  onToggleTask: (task: Task) => void;
  onAddTask: (title: string) => void;
}

function panelTitle(selection: Selection, projects: Project[]): string {
  switch (selection.kind) {
    case 'today':
      return 'Today';
    case 'upcoming':
      return 'Upcoming';
    case 'all':
      return 'All tasks';
    case 'project':
      return projects.find((p) => p.id === selection.projectId)?.name ?? 'Project';
  }
}

export function TaskListPanel({
  selection,
  model,
  projects,
  today,
  selectedTaskId,
  onOpenDrawer,
  onSelectTask,
  onToggleTask,
  onAddTask,
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
        <h1>{panelTitle(selection, projects)}</h1>
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
