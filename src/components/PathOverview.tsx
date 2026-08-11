import { useEffect, useMemo, useRef } from 'react';
import type { Project, Task } from '../types/task';
import { buildGrid } from '../lib/pathGrid';
import { MONTH_NAMES, dayOf } from '../lib/dates';

interface Props {
  tasks: Task[];
  projects: Project[];
  today: string;
  onOpenDrawer?: () => void;
  onSelectTask: (id: string) => void;
  /** Picking a day is what the calendar is for — it opens that day. */
  onSelectDay: (date: string) => void;
  onClose: () => void;
}

const WEEKS = 4;

/** Monday first, matching the weekday picker in the repeat settings. */
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Four weeks at a glance — one row per week, so scrolling down is moving
 * forward in time.
 *
 * This is for looking, not changing. Its job is to answer one question before
 * you commit to a shape: given the repeat rules you've set, do things actually
 * land on the days you wanted? Nothing here is stored — the grid is derived
 * from the rules every time it renders, so looking at a future week never
 * creates anything.
 */
export function PathOverview({
  tasks,
  projects,
  today,
  onOpenDrawer,
  onSelectTask,
  onSelectDay,
  onClose,
}: Props) {
  const weeks = useMemo(() => buildGrid(tasks, today, WEEKS), [tasks, today]);
  const colorOf = (projectId: string | null) =>
    projects.find((p) => p.id === projectId)?.colorId ?? null;

  // The grid starts on the week's Monday so no row is half a week, which means
  // today can sit several days in — six cards down on a phone, where one day
  // fills the width. Opening on today is the whole point, so scroll to it.
  const todayRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // `nearest` scrolls the least it can, so it does nothing when today is
    // already on screen. `start` dragged the header off the top of a desktop
    // view where today was visible in the first row anyway.
    todayRef.current?.scrollIntoView({ block: 'nearest' });
  }, [today]);

  return (
    <main className="path-overview">
      <header className="panel-header">
        {onOpenDrawer && (
          <button
            type="button"
            className="drawer-button"
            aria-label="Open menu"
            onClick={onOpenDrawer}
          >
            ☰
          </button>
        )}
        <h1>Four weeks</h1>
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Back to the day
        </button>
      </header>

      <p className="path-overview__hint">
        As your repeat rules lay them out. Scroll down to go further ahead, or pick a day to open
        it.
      </p>

      <ol className="path-weeks">
        {weeks.map((week) => {
          const isCurrent = week.days.some((day) => day.date === today);
          return (
            <li
              key={week.start}
              className={isCurrent ? 'path-week path-week--current' : 'path-week'}
            >
              <ol className="path-week__days">
                {week.days.map((day, index) => {
                  const classes = ['path-day'];
                  if (day.date === today) classes.push('path-day--today');
                  else if (day.date < today) classes.push('path-day--past');

                  // Named at the start of every row, and again wherever a month
                  // turns over, so scrolling forward never loses track of when.
                  const showMonth = index === 0 || dayOf(day.date) === 1;

                  return (
                    <li
                      key={day.date}
                      ref={day.date === today ? todayRef : undefined}
                      className={classes.join(' ')}
                      aria-current={day.date === today ? 'date' : undefined}
                    >
                      <button
                        type="button"
                        className="path-day__date"
                        onClick={() => onSelectDay(day.date)}
                      >
                        {/*
                          Today says so in words, not only in colour. Colour is
                          the theme's job and a theme can be swapped out; which
                          day you're on has to survive that.
                        */}
                        <span className="path-day__weekday">
                          {day.date === today ? 'Today' : WEEKDAY_LABELS[(day.weekday + 6) % 7]}
                        </span>
                        <span className="path-day__number">{dayOf(day.date)}</span>
                        {showMonth && (
                          <span className="path-day__month">
                            {MONTH_NAMES[Number(day.date.slice(5, 7)) - 1]}
                          </span>
                        )}
                      </button>

                      {day.tasks.length === 0 ? (
                        <p className="path-day__clear">—</p>
                      ) : (
                        <ul className="path-day__tasks">
                          {day.tasks.map((task) => {
                            const color = colorOf(task.projectId);
                            return (
                              <li key={task.id}>
                                <button
                                  type="button"
                                  className="path-task"
                                  onClick={() => onSelectTask(task.id)}
                                >
                                  {color !== null && (
                                    <span
                                      className="project-dot"
                                      data-color={color}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="path-task__title">{task.title}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
