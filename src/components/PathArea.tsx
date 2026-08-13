import { useState } from 'react';
import type { Project, Task } from '../types/task';
import type { DayLog, PathEntry, PathPattern } from '../types/path';
import type { EntryChanges } from '../store/mutations';
import { todayStr } from '../lib/dates';
import { PathDay } from './PathDay';
import { PathOverview } from './PathOverview';

interface Props {
  tasks: Task[];
  projects: Project[];
  pattern: PathPattern | null;
  logs: DayLog[];
  today: string;
  /**
   * The day being looked at. Owned above rather than here because the library
   * beside the path offers what lands on it — two columns reading one date.
   */
  date: string;
  onSelectDate: (date: string) => void;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onClearEntry: (date: string, entryId: string, cleared: boolean) => void;
  /*
   * Every edit takes the date it happened on. The pattern is keyed by weekday,
   * but nothing in the UI ever talks in weekdays — you arrange a Tuesday by
   * looking at a Tuesday, and turning that into "weekday 2" is the store's job.
   */
  onInsertEntry: (date: string, index: number, entry: PathEntry) => void;
  onMoveEntry: (date: string, from: number, to: number) => void;
  onRemoveEntry: (date: string, entryId: string) => void;
  onEditEntry: (date: string, entryId: string, changes: EntryChanges) => void;
  onFillWildcard: (date: string, entryId: string, taskIds: string[]) => void;
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
  pattern,
  logs,
  today,
  date,
  onSelectDate,
  selectedTaskId,
  onSelectTask,
  onClearEntry,
  onInsertEntry,
  onMoveEntry,
  onRemoveEntry,
  onEditEntry,
  onFillWildcard,
  header,
  onOpenDrawer,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  // A day left open overnight shouldn't still be showing yesterday.
  const viewing = date < todayStr() && date === today ? todayStr() : date;

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
            onSelectDate(picked);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      ) : (
        <PathDay
          tasks={tasks}
          projects={projects}
          date={viewing}
          today={today}
          selectedTaskId={selectedTaskId}
          onOpenCalendar={() => setCalendarOpen(true)}
          onSelectTask={onSelectTask}
          pattern={pattern}
          log={logs.find((l) => l.date === viewing) ?? null}
          onClearEntry={(entryId, cleared) => onClearEntry(viewing, entryId, cleared)}
          onInsertEntry={(index, entry) => onInsertEntry(viewing, index, entry)}
          onMoveEntry={(from, to) => onMoveEntry(viewing, from, to)}
          onRemoveEntry={(entryId) => onRemoveEntry(viewing, entryId)}
          onEditEntry={(entryId, changes) => onEditEntry(viewing, entryId, changes)}
          onFillWildcard={(entryId, taskIds) => onFillWildcard(viewing, entryId, taskIds)}
        />
      )}
    </main>
  );
}
