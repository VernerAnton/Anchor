import { useState } from 'react';
import type { Project, Task } from '../types/task';
import { landsOn } from '../lib/pathGrid';
import { todayStr } from '../lib/dates';
import { PathDay } from './PathDay';
import { PathOverview } from './PathOverview';

interface Props {
  tasks: Task[];
  projects: Project[];
  today: string;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onToggleTask: (task: Task) => void;
  /** Rendered above the day in to-do mode: the switch into path mode. */
  header?: React.ReactNode;
  onOpenDrawer?: () => void;
}

/**
 * The path itself — one day, with the four-week calendar behind its date.
 *
 * Shared by both modes so there is one implementation of "the path", not a
 * full-screen one and a preview one that drift apart. What differs between
 * modes is only what surrounds it.
 */
export function PathArea({
  tasks,
  projects,
  today,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  header,
  onOpenDrawer,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [date, setDate] = useState(today);

  // A day left open overnight shouldn't still be showing yesterday.
  const viewing = date < todayStr() && date === today ? todayStr() : date;
  const dayTasks = tasks.filter((task) => landsOn(task, viewing));

  return (
    <main className="path-area">
      {header}

      {calendarOpen ? (
        <PathOverview
          tasks={tasks}
          projects={projects}
          today={today}
          onOpenDrawer={onOpenDrawer}
          onSelectTask={onSelectTask}
          onSelectDay={(picked) => {
            setDate(picked);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      ) : (
        <PathDay
          tasks={dayTasks}
          projects={projects}
          date={viewing}
          today={today}
          selectedTaskId={selectedTaskId}
          onOpenCalendar={() => setCalendarOpen(true)}
          onSelectTask={onSelectTask}
          onToggleTask={onToggleTask}
        />
      )}
    </main>
  );
}
