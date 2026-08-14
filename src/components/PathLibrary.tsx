import { useMemo, useState } from 'react';
import type { Project } from '../types/task';
import type { LandingTask } from '../lib/day';
import { landingByProject } from '../lib/day';
import { TASK_DRAG } from './PathInsert';

interface Props {
  projects: Project[];
  /** What lands on the day being built — a task's own rule decides, not this. */
  landing: LandingTask[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  /** `null` files the task under nothing, which is what "All tasks" means here. */
  onAddTask: (title: string, projectId: string | null) => void;
  onNewProject: () => void;
}

/**
 * The right column of path mode: what can go on the day, in its project
 * sections.
 *
 * Two things at once, and both are needed while building. *What's available*
 * — only what already lands on this day, so dragging something onto it never
 * has to guess whether you also meant to change how often it repeats. And
 * *what it belongs to* — the same sections the library always had, because a
 * task's project is half of what tells you what the task is.
 *
 * Sections stay put on a quiet day rather than disappearing, so the place
 * keeps its shape and you can still file something into any project. Typing
 * into a section files it there and dates it to the day you're building,
 * since that is plainly what typing into this particular list means.
 */
export function PathLibrary({
  projects,
  landing,
  selectedTaskId,
  onSelectTask,
  onAddTask,
  onNewProject,
}: Props) {
  const sections = useMemo(() => landingByProject(landing, projects), [landing, projects]);

  return (
    <aside className="path-library" aria-label="What lands on this day">
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
              {section.tasks.map(({ task, placed }) => (
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
                    {/* Stays in the list once placed. Putting the same thing on
                        a day twice is ordinary, not a special move. */}
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
