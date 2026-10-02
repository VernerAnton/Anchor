import type { TaskRowModel } from '../lib/views';

interface Props {
  row: TaskRowModel;
  selected: boolean;
  onToggle(id: string, done: boolean): void;
  onOpen(id: string): void;
}

/**
 * One task in a list. Renders the row it's given — status arrives decided.
 *
 * The checkbox is a real checkbox, so "done" is carried by the control itself
 * and survives any theme, including none.
 */
export function TaskRow({ row, selected, onToggle, onOpen }: Props) {
  const done = row.status === 'done';
  const classes = ['task-row', `task-row--${row.status}`];
  if (selected) classes.push('task-row--selected');

  return (
    <li className={classes.join(' ')}>
      <input
        type="checkbox"
        className="task-row__check"
        data-check-task={row.id}
        checked={done}
        onChange={() => onToggle(row.id, !done)}
        aria-label={`Done: ${row.title}`}
      />
      <button
        type="button"
        className="task-row__open"
        data-open-task={row.id}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onOpen(row.id)}
      >
        <span className="task-row__title">{row.title}</span>
      </button>
    </li>
  );
}
