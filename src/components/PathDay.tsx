import type { Project, Task } from '../types/task';
import { MONTH_NAMES, dayOf, weekdayOf } from '../lib/dates';

interface Props {
  tasks: Task[];
  projects: Project[];
  date: string;
  today: string;
  selectedTaskId: string | null;
  onOpenCalendar: () => void;
  onSelectTask: (id: string) => void;
  onToggleTask: (task: Task) => void;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Drawn rather than typed: an emoji depends on a font being present, and it
 * renders as an empty box wherever it isn't. `currentColor` keeps it a theme
 * decision, not a hardcoded one.
 */
function CalendarIcon() {
  return (
    <svg
      className="path-day-view__calendar"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
      <path d="M1.5 6.5h13M5 1.5V4M11 1.5V4" />
    </svg>
  );
}

/**
 * One day, as a route. The left column of path mode, and where the app opens.
 *
 * The date at the top is the button that opens the four-week calendar — the
 * date is exactly what that view changes, whereas a corner of the screen is
 * next to controls that have nothing to do with it.
 *
 * Nothing here can be rearranged yet. Ordering, times and rest arrive with the
 * day editor; until then this shows what the day holds, in the order the tasks
 * already carry.
 */
export function PathDay({
  tasks,
  projects,
  date,
  today,
  selectedTaskId,
  onOpenCalendar,
  onSelectTask,
  onToggleTask,
}: Props) {
  const colorOf = (projectId: string | null) =>
    projects.find((p) => p.id === projectId)?.colorId ?? null;

  const heading =
    date === today
      ? 'Today'
      : `${WEEKDAY_NAMES[weekdayOf(date)]} ${dayOf(date)} ${MONTH_NAMES[Number(date.slice(5, 7)) - 1]}`;

  return (
    <section className="path-day-view" aria-label="Today's path">
      <header className="path-day-view__head">
        <button type="button" className="path-day-view__date" onClick={onOpenCalendar}>
          <span className="path-day-view__heading">{heading}</span>
          <CalendarIcon />
          <span className="visually-hidden">Open the four-week calendar</span>
        </button>
      </header>

      {tasks.length === 0 ? (
        <p className="path-day-view__clear">
          Nothing on the path today. That's a legitimate answer, not an empty one.
        </p>
      ) : (
        <ol className="path-points">
          {tasks.map((task) => {
            const color = colorOf(task.projectId);
            const done = task.completedAt !== null;
            const classes = ['path-point'];
            if (done) classes.push('path-point--done');
            if (task.id === selectedTaskId) classes.push('path-point--selected');

            return (
              <li key={task.id} className={classes.join(' ')}>
                <button
                  type="button"
                  className="task-check"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  onClick={() => onToggleTask(task)}
                />
                <button
                  type="button"
                  className="path-point__body"
                  onClick={() => onSelectTask(task.id)}
                >
                  <span className="path-point__title">{task.title}</span>
                  {task.firstMove !== null && (
                    <span className="path-point__first-move">{task.firstMove}</span>
                  )}
                </button>
                {color !== null && (
                  <span className="project-dot" data-color={color} aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
