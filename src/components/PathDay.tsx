import type { Project, Task } from '../types/task';
import { MONTH_NAMES, dayOf, weekdayOf } from '../lib/dates';
import { buildDay } from '../lib/day';
import { clockOf } from '../lib/dayTimes';

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
 * The day is derived, never stored: `buildDay` recomputes it on every render
 * from the tasks and their rules. Points show the clock they run at — dimmed
 * when the time was inherited from whatever came before rather than set on the
 * task itself — and rest is drawn between them, in proportion.
 *
 * Still read-only. Rearranging, retiming and completing a point on the path
 * belong to the day editor and to the path proper.
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
  const segments = buildDay(tasks, date);
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

      {segments.length === 0 ? (
        <p className="path-day-view__clear">
          Nothing on the path today. That's a legitimate answer, not an empty one.
        </p>
      ) : (
        <ol className="path-points">
          {segments.map((segment) => {
            if (segment.kind === 'rest') {
              return (
                <li
                  key={`rest-${segment.startsAt}`}
                  className="path-rest"
                  /* The one sanctioned inline style: a genuinely computed
                     value. A forty-minute gap is drawn longer than a fifteen,
                     so the shape of a day is read rather than added up. */
                  style={{ '--rest-minutes': segment.minutes } as React.CSSProperties}
                >
                  <span className="path-rest__label">Rest · {segment.minutes} min</span>
                </li>
              );
            }

            const { task } = segment;
            const color = colorOf(task.projectId);
            const done = task.completedAt !== null;
            const classes = ['path-point'];
            if (done) classes.push('path-point--done');
            if (task.id === selectedTaskId) classes.push('path-point--selected');

            return (
              <li key={task.id} className={classes.join(' ')}>
                <span
                  className={segment.anchored ? 'path-point__clock' : 'path-point__clock path-point__clock--follows'}
                >
                  {clockOf(segment.startsAt)}
                </span>
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
                  className="path-point__body brackets"
                  onClick={() => onSelectTask(task.id)}
                >
                  <span className="path-point__title">{task.title}</span>
                  {task.firstMove !== null && (
                    <span className="path-point__first-move">{task.firstMove}</span>
                  )}
                  <span className="path-point__length">
                    {segment.endsAt - segment.startsAt} min
                    {task.defaultDuration?.kind === 'natural' && ' · runs to completion'}
                  </span>
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
