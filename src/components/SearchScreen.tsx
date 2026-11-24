import { useEffect, useRef, type Ref } from 'react';
import type { SearchModel } from '../lib/search';
import { TaskRowList, type RowHandlers } from './TaskRows';

interface Props extends Omit<RowHandlers, 'onMove'> {
  model: SearchModel;
  onOpenMenu: (() => void) | null;
  menuButtonRef: Ref<HTMLButtonElement>;
  headingRef: Ref<HTMLHeadingElement>;
  onQuery(query: string): void;
}

/**
 * One box, results as you type. The query lives in the URL, so a result can be
 * opened, closed, and Back returns to the same search.
 */
export function SearchScreen({ model, onOpenMenu, menuButtonRef, headingRef, onQuery, ...handlers }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Opening Search is asking to type: the box takes focus.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const rowHandlers = { ...handlers, onMove: null };
  const total = model.open.length + model.completed.length;

  return (
    <section className="list-panel search" aria-labelledby="list-heading">
      <header className="list-panel__header">
        {onOpenMenu && (
          <button type="button" className="button" ref={menuButtonRef} onClick={onOpenMenu} aria-controls="sidebar">
            Menu
          </button>
        )}
        <h1 id="list-heading" className="list-panel__title" tabIndex={-1} ref={headingRef}>
          Search
        </h1>
      </header>

      <form className="quick-add" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="visually-hidden" htmlFor="search-query">
          Search titles and notes
        </label>
        <input
          id="search-query"
          ref={inputRef}
          className="quick-add__input text-input"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search titles and notes"
          value={model.query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </form>

      {/* Announced as it changes, so a screen reader hears how many matched. */}
      <p className="list-panel__message" role="status">
        {model.message ?? (total === 1 ? '1 task matches.' : `${total} tasks match.`)}
      </p>

      {model.open.length > 0 && <TaskRowList rows={model.open} label="Matching tasks" {...rowHandlers} />}

      {model.completed.length > 0 && (
        <details className="completed-block" open={model.open.length === 0}>
          <summary className="completed-block__summary">
            Completed <span className="completed-block__count">{model.completed.length}</span>
          </summary>
          <TaskRowList rows={model.completed} label="Matching completed tasks" {...rowHandlers} />
        </details>
      )}
    </section>
  );
}
