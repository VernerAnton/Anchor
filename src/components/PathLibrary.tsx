import { useMemo } from 'react';
import type { Project, Task } from '../types/task';
import { groupByProject } from '../lib/pathGrid';

interface Props {
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
}

/**
 * Every task in the app, grouped into sections by project — the right column
 * of path mode, and what replaces the sidebar's project list.
 *
 * In to-do mode you click a project on the left to filter down to it. Here the
 * sections do that job by being there: you scroll to a project instead of
 * selecting it. Same information, one less click, and it leaves the left of
 * the screen entirely to the day.
 */
export function PathLibrary({ tasks, projects, selectedTaskId, onSelectTask }: Props) {
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
            <span className="badge">{section.tasks.length}</span>
          </h2>

          {section.tasks.length === 0 ? (
            <p className="path-library__empty">Nothing here.</p>
          ) : (
            <ul className="path-library__tasks">
              {section.tasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={
                      task.id === selectedTaskId
                        ? 'library-task library-task--selected'
                        : 'library-task'
                    }
                    onClick={() => onSelectTask(task.id)}
                  >
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </aside>
  );
}
