import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { TaskRowModel } from '../lib/views';

export interface RowHandlers {
  selectedId: string | null;
  onToggle(id: string, done: boolean): void;
  onOpen(id: string): void;
  /**
   * Manual order only: move `id` to `toIndex` among the others, as shown.
   * `shown` is the list's ids in display order.
   */
  onMove: ((shown: string[], id: string, toIndex: number) => void) | null;
}

interface ListProps extends RowHandlers {
  rows: TaskRowModel[];
  label?: string;
  sub?: boolean;
}

interface Drag {
  id: string;
  /** Where it would land, counted among the other rows. */
  index: number;
}

/**
 * A list of rows, and — in manual order — the moving of them.
 *
 * Two ways to move a row, both on its handle: drag it (mouse, pen or touch,
 * through pointer events, which work on all three), or focus it and press the
 * arrow keys. Measuring rows to find the drop point is the one piece of
 * geometry in the app, and it lives here because it's about the screen, not
 * about the data. The decision of what to write is `reorderPlan`'s.
 */
export function TaskRowList({ rows, label, sub = false, ...handlers }: ListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const refocus = useRef<string | null>(null);
  const ids = rows.map((row) => row.id);

  // After a keyboard move, keep focus on the handle that moved.
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-move-task="${id}"]`)?.focus();
  });

  const move = (id: string, toIndex: number) => handlers.onMove?.(ids, id, toIndex);

  const indexAt = (id: string, clientY: number): number => {
    const others = [...(listRef.current?.children ?? [])].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.dataset.rowId !== id,
    );
    const at = others.findIndex((el) => {
      const box = el.getBoundingClientRect();
      return clientY < box.top + box.height / 2;
    });
    return at === -1 ? others.length : at;
  };

  const reorder = handlers.onMove
    ? {
        onPointerDown(id: string, event: PointerEvent<HTMLButtonElement>) {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ id, index: ids.indexOf(id) });
        },
        onPointerMove(id: string, event: PointerEvent<HTMLButtonElement>) {
          if (drag?.id !== id) return;
          const index = indexAt(id, event.clientY);
          if (index !== drag.index) setDrag({ id, index });
        },
        onPointerUp(id: string) {
          if (drag?.id === id && drag.index !== ids.indexOf(id)) move(id, drag.index);
          setDrag(null);
        },
        onPointerCancel() {
          setDrag(null);
        },
        onKeyDown(id: string, event: KeyboardEvent<HTMLButtonElement>) {
          const from = ids.indexOf(id);
          const to = event.key === 'ArrowUp' ? from - 1 : event.key === 'ArrowDown' ? from + 1 : null;
          if (to === null) return;
          event.preventDefault();
          if (to < 0 || to >= ids.length) return;
          refocus.current = id;
          move(id, to);
        },
      }
    : null;

  // The row the dragged one would land in front of — among the others.
  const others = drag ? ids.filter((id) => id !== drag.id) : [];
  const dropBefore = drag ? (others[drag.index] ?? null) : null;
  const dropAtEnd = drag !== null && drag.index >= others.length && drag.index !== ids.indexOf(drag.id);
  const classes = [sub ? 'subtask-list' : 'task-list'];
  if (dropAtEnd) classes.push('task-list--drop-end');

  return (
    <ul className={classes.join(' ')} ref={listRef} aria-label={label}>
      {rows.map((row) => (
        <TaskRow
          key={row.id}
          row={row}
          sub={sub}
          dragging={drag?.id === row.id}
          dropBefore={dropBefore === row.id && drag!.index !== ids.indexOf(drag!.id)}
          reorder={reorder}
          {...handlers}
        />
      ))}
    </ul>
  );
}

interface RowProps extends RowHandlers {
  row: TaskRowModel;
  sub: boolean;
  dragging: boolean;
  dropBefore: boolean;
  reorder: {
    onPointerDown(id: string, event: PointerEvent<HTMLButtonElement>): void;
    onPointerMove(id: string, event: PointerEvent<HTMLButtonElement>): void;
    onPointerUp(id: string): void;
    onPointerCancel(): void;
    onKeyDown(id: string, event: KeyboardEvent<HTMLButtonElement>): void;
  } | null;
}

/**
 * One task in a list. Renders the row it's given — status, which meta to
 * show and which to leave off all arrive decided.
 *
 * The checkbox is a real checkbox, so "done" is carried by the control itself
 * and survives any theme, including none.
 */
function TaskRow({ row, sub, dragging, dropBefore, reorder, ...handlers }: RowProps) {
  const { selectedId, onToggle, onOpen } = handlers;
  const done = row.status === 'done';
  const selected = row.id === selectedId;
  const classes = ['task-row', `task-row--${row.status}`];
  if (sub) classes.push('task-row--subtask');
  if (selected) classes.push('task-row--selected');
  if (dragging) classes.push('task-row--dragging');
  if (dropBefore) classes.push('task-row--drop-before');
  const hasMeta =
    row.priority !== null ||
    row.project !== null ||
    row.labels.length > 0 ||
    row.due !== null ||
    row.recurrence !== null ||
    row.parentTitle !== null;

  return (
    <li className={classes.join(' ')} data-row-id={row.id}>
      <div className="task-row__main">
        {reorder && (
          <button
            type="button"
            className="task-row__handle"
            data-move-task={row.id}
            aria-label={`Move ${row.title}. Drag, or use the up and down arrow keys.`}
            onPointerDown={(event) => reorder.onPointerDown(row.id, event)}
            onPointerMove={(event) => reorder.onPointerMove(row.id, event)}
            onPointerUp={() => reorder.onPointerUp(row.id)}
            onPointerCancel={reorder.onPointerCancel}
            onKeyDown={(event) => reorder.onKeyDown(row.id, event)}
          >
            <span aria-hidden="true">⠿</span>
          </button>
        )}
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
              {row.due !== null && (
                <span className={row.due.past ? 'meta-due meta-due--past' : 'meta-due'}>
                  {row.due.label}
                </span>
              )}
              {row.recurrence !== null && (
                <span className="meta-recurrence">
                  <span aria-hidden="true">↻ </span>
                  <span className="visually-hidden">Repeats </span>
                  {row.recurrence}
                </span>
              )}
              {row.project !== null && (
                <span className="meta-project">
                  <span className="project-dot" data-color={row.project.colorId} aria-hidden="true" />
                  {row.project.name}
                </span>
              )}
              {row.labels.map((label) => (
                <span key={label.id} className="label-chip" data-color={label.colorId}>
                  {label.name}
                </span>
              ))}
              {row.parentTitle !== null && <span className="meta-parent">Part of {row.parentTitle}</span>}
            </span>
          )}
          {row.note !== null && <span className="task-row__note">{row.note}</span>}
        </button>
      </div>

      {row.subtasks.length > 0 && (
        <TaskRowList rows={row.subtasks} label={`Subtasks of ${row.title}`} sub {...handlers} />
      )}
    </li>
  );
}
