import { useMemo, useState } from 'react';
import type { Project, Task } from '../types/task';
import { groupByProject } from '../lib/pathGrid';

interface Props {
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  /** `null` files the task under nothing, which is what "All tasks" means here. */
  onAddTask: (title: string, projectId: string | null) => void;
  onNewProject: () => void;
}

/**
 * Every task in the app, grouped into sections by project — the right column
 * of path mode, and what replaces the sidebar's project list.
 *
 * In to-do mode you click a project on the left to filter down to it. Here the
 * sections do that job by being there: you scroll to a project instead of
 * selecting it. Same information, one less click, and it leaves the left of
 * the screen entirely to the day.
 *
 * Each section adds its own tasks. Because the section already says which
 * project you're in, typing into it files the task there — no picking a
 * project afterwards from a panel you'd have to open first.
 */
export function PathLibrary({
  tasks,
  projects,
  selectedTaskId,
  onSelectTask,
  onAddTask,
  onNewProject,
}: Props) {
  const sections = useMemo(() => groupByProject(tasks, projects), [tasks, projects]);

  return (
    <aside className="path-library" aria-label="All tasks">
      {sections.map((section) => (
        <section key={section.key} className="path-library__section">
          <h2 className="path-library__title">
            {section.project !== null && (
              <span
                className="project-dot"
                data-color={section.project.colorId}
                aria-hidden="true"
              />
            )}
            <span>{section.title}</span>
            <span className="badge">{String(section.tasks.length).padStart(2, '0')}</span>
          </h2>

          {section.tasks.length > 0 && (
            <ul className="path-library__tasks">
              {section.tasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={
                      task.id === selectedTaskId
                        ? 'library-task brackets library-task--selected'
                        : 'library-task brackets'
                    }
                    onClick={() => onSelectTask(task.id)}
                  >
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <QuickAdd
            label={`Add a task to ${section.title}`}
            onAdd={(title) => onAddTask(title, section.project?.id ?? null)}
          />
        </section>
      ))}

      <button type="button" className="library-new-project brackets" onClick={onNewProject}>
        + New project
      </button>
    </aside>
  );
}

function QuickAdd({ label, onAdd }: { label: string; onAdd: (title: string) => void }) {
  const [draft, setDraft] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft('');
  };

  return (
    <form className="library-add" onSubmit={submit}>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Add a task"
        aria-label={label}
      />
      {/* Present for keyboard and screen readers; Enter submits either way. */}
      <button type="submit" className="visually-hidden" disabled={!draft.trim()}>
        Add
      </button>
    </form>
  );
}
