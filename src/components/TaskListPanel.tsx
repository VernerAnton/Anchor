import type { Ref } from 'react';
import type { ListModel } from '../lib/views';
import { QuickAdd } from './QuickAdd';
import { TaskRow } from './TaskRow';

interface Props {
  title: string;
  /** `null` while the store hasn't answered yet. */
  list: ListModel | null;
  selectedId: string | null;
  /** Shown only in the narrow layout, where the sidebar is a drawer. */
  onOpenMenu: (() => void) | null;
  menuButtonRef: Ref<HTMLButtonElement>;
  headingRef: Ref<HTMLHeadingElement>;
  onAdd(title: string): void;
  onToggle(id: string, done: boolean): void;
  onOpen(id: string): void;
}

/** A view's list: its heading, quick add, the open rows, and what's done. */
export function TaskListPanel({
  title,
  list,
  selectedId,
  onOpenMenu,
  menuButtonRef,
  headingRef,
  onAdd,
  onToggle,
  onOpen,
}: Props) {
  return (
    <section className="list-panel" aria-labelledby="list-heading">
      <header className="list-panel__header">
        {onOpenMenu && (
          <button
            type="button"
            className="button"
            ref={menuButtonRef}
            onClick={onOpenMenu}
            aria-controls="sidebar"
          >
            Menu
          </button>
        )}
        <h1 id="list-heading" className="list-panel__title" tabIndex={-1} ref={headingRef}>
          {title}
        </h1>
      </header>

      <QuickAdd onAdd={onAdd} />

      {list === null ? (
        <p className="list-panel__message" role="status">
          Loading tasks…
        </p>
      ) : (
        <>
          {list.open.length > 0 ? (
            <ul className="task-list">
              {list.open.map((row) => (
                <TaskRow
                  key={row.id}
                  row={row}
                  selected={row.id === selectedId}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          ) : (
            <p className="list-panel__message">
              {list.completed.length > 0
                ? 'Nothing open here right now.'
                : 'Nothing here yet. Anything you add above will appear in this list.'}
            </p>
          )}

          {list.completed.length > 0 && (
            <details className="completed-block">
              <summary className="completed-block__summary">
                Completed <span className="completed-block__count">{list.completed.length}</span>
              </summary>
              <ul className="task-list">
                {list.completed.map((row) => (
                  <TaskRow
                    key={row.id}
                    row={row}
                    selected={row.id === selectedId}
                    onToggle={onToggle}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
