import { useMemo, useState } from 'react';
import type { Project, Task } from '../types/task';
import type { LandingTask } from '../lib/day';
import { groupByProject } from '../lib/pathGrid';
import { TASK_DRAG } from './PathInsert';

interface Props {
  tasks: Task[];
  projects: Project[];
  /** What the day being looked at already offers — a task's own rule decides. */
  landing: LandingTask[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  /** `null` files the task under nothing, which is what "All tasks" means here. */
  onAddTask: (title: string, projectId: string | null) => void;
  onNewProject: () => void;
}

/**
 * The right column of path mode, in two halves.
 *
 * The top half is what lands on the day you're looking at — the things that
 * can go onto it, and the only place you drag from. Everything a task's repeat
 * rule says about *when* is already decided by the time it appears here, which
 * is what makes dragging it onto the day unambiguous: there is no version of
 * the drop that has to guess whether you also meant to change the rule.
 *
 * The bottom half is the whole library by project, which is where you file and
 * find things. It isn't a drag source, because most of what's in it doesn't
 * belong on today at all.
 */
export function PathLibrary({
  tasks,
  projects,
  landing,
  selectedTaskId,
  onSelectTask,
  onAddTask,
  onNewProject,
}: Props) {
  const sections = useMemo(() => groupByProject(tasks, projects), [tasks, projects]);

  return (
    <aside className="path-library" aria-label="Tasks">
      <section className="path-library__section path-library__section--landing">
        <h2 className="path-library__title">
          <span>Lands on this day</span>
          <span className="badge">{String(landing.length).padStart(2, '0')}</span>
        </h2>

        {landing.length === 0 ? (
          <p className="path-library__empty">
            Nothing repeats onto this day yet. Set how often something happens on the task itself,
            and it turns up here.
          </p>
        ) : (
          <ul className="path-library__tasks">
            {landing.map(({ task, placed }) => (
              <li key={task.id}>
                <button
                  type="button"
                  className={
                    task.id === selectedTaskId
                      ? 'library-task brackets library-task--selected'
                      : 'library-task brackets'
                  }
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(TASK_DRAG, task.id);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => onSelectTask(task.id)}
                >
                  <span className="library-task__title">{task.title}</span>
                  {/* Stays in the list once placed. Putting the same thing on a
                      day twice is ordinary, not a special move. */}
                  {placed > 0 && (
                    <span className="library-task__placed">
                      on the path{placed > 1 ? ` ×${placed}` : ''}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                    <span className="library-task__title">{task.title}</span>
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
