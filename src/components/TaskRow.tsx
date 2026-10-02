import type { TaskRowModel } from '../lib/views';

interface Props {
  row: TaskRowModel;
  selectedId: string | null;
  onToggle(id: string, done: boolean): void;
  onOpen(id: string): void;
  /** Nested under a parent row. */
  sub?: boolean;
}

/**
 * One task in a list. Renders the row it's given — status, which meta to
 * show and which to leave off all arrive decided.
 *
 * The checkbox is a real checkbox, so "done" is carried by the control itself
 * and survives any theme, including none.
 */
export function TaskRow({ row, selectedId, onToggle, onOpen, sub = false }: Props) {
  const done = row.status === 'done';
  const selected = row.id === selectedId;
  const classes = ['task-row', `task-row--${row.status}`];
  if (sub) classes.push('task-row--subtask');
  if (selected) classes.push('task-row--selected');
  const hasMeta = row.priority !== null || row.project !== null || row.due !== null || row.parentTitle !== null;

  return (
    <li className={classes.join(' ')}>
      <div className="task-row__main">
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
          {hasMeta && (
            <span className="task-row__meta">
              {row.priority !== null && (
                <span className="priority-flag" data-priority={row.priority}>
                  P{row.priority}
                </span>
              )}
              {row.project !== null && (
                <span className="meta-project">
                  <span className="project-dot" data-color={row.project.colorId} aria-hidden="true" />
                  {row.project.name}
                </span>
              )}
              {row.due !== null && (
                <span className={row.due.past ? 'meta-due meta-due--past' : 'meta-due'}>
                  {row.due.label}
                </span>
              )}
              {row.parentTitle !== null && (
                <span className="meta-parent">Part of {row.parentTitle}</span>
              )}
            </span>
          )}
          {row.note !== null && <span className="task-row__note">{row.note}</span>}
        </button>
      </div>

      {row.subtasks.length > 0 && (
        <ul className="subtask-list" aria-label={`Subtasks of ${row.title}`}>
          {row.subtasks.map((subRow) => (
            <TaskRow
              key={subRow.id}
              row={subRow}
              selectedId={selectedId}
              onToggle={onToggle}
              onOpen={onOpen}
              sub
            />
          ))}
        </ul>
      )}
    </li>
  );
}
