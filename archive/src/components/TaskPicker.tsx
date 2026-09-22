import { useMemo, useState } from 'react';
import type { LandingTask } from '../lib/day';

interface Props {
  /** What may be picked. Who decides that is the caller's business. */
  landing: LandingTask[];
  /** Said when nothing matches, or when there was nothing to begin with. */
  emptyNote: string;
  onPick: (taskId: string) => void;
  onCancel: () => void;
}

/**
 * Search a list of tasks and pick one.
 *
 * Already-placed tasks stay in the list, marked with how many times they are
 * on the day. Hiding them would make placing the same task twice — a morning
 * study block and an afternoon one — into a special gesture, when it is just
 * picking the same thing again.
 */
export function TaskPicker({ landing, emptyNote, onPick, onCancel }: Props) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return landing;
    return landing.filter((option) => option.task.title.toLowerCase().includes(needle));
  }, [landing, query]);

  return (
    <div className="task-picker">
      <form
        className="task-picker__search"
        onSubmit={(event) => {
          event.preventDefault();
          // Enter takes the top match, so a search that narrows to one thing
          // never needs the mouse to finish.
          const first = matches[0];
          if (first) onPick(first.task.id);
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search tasks"
        />
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Back
        </button>
      </form>

      {matches.length === 0 ? (
        <p className="task-picker__empty">{emptyNote}</p>
      ) : (
        <ul className="task-picker__list">
          {matches.map(({ task, placed }) => (
            <li key={task.id}>
              <button type="button" className="task-picker__option" onClick={() => onPick(task.id)}>
                <span className="task-picker__title">{task.title}</span>
                {placed > 0 && (
                  <span className="task-picker__placed">
                    on the day{placed > 1 ? ` ×${placed}` : ''}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
