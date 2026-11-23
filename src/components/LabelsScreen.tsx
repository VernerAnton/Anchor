import { useEffect, useRef, useState, type FormEvent, type Ref } from 'react';
import { PROJECT_COLOR_IDS, type ProjectColor } from '../types/task';
import { selectionHref } from '../lib/selection';
import type { LabelsScreenRow } from '../lib/views';
import { COLOR_NAMES } from './ProjectEditor';

interface Props {
  rows: LabelsScreenRow[];
  onOpenMenu: (() => void) | null;
  menuButtonRef: Ref<HTMLButtonElement>;
  headingRef: Ref<HTMLHeadingElement>;
  onCreate(name: string): void;
  onRename(id: string, name: string): void;
  onRecolor(id: string, colorId: ProjectColor): void;
  /** Swaps a label with its neighbour. */
  onSwap(id: string, withId: string): void;
  onDelete(id: string): void;
}

/**
 * Every label, renamed and reordered in place. Not a dialog: renaming is a
 * comparison with the names around it, and a modal would take away the list
 * you came to compare against.
 */
export function LabelsScreen({
  rows,
  onOpenMenu,
  menuButtonRef,
  headingRef,
  onCreate,
  onRename,
  onRecolor,
  onSwap,
  onDelete,
}: Props) {
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name);
    setName('');
  };

  return (
    <section className="list-panel labels-screen" aria-labelledby="list-heading">
      <header className="list-panel__header">
        {onOpenMenu && (
          <button type="button" className="button" ref={menuButtonRef} onClick={onOpenMenu} aria-controls="sidebar">
            Menu
          </button>
        )}
        <h1 id="list-heading" className="list-panel__title" tabIndex={-1} ref={headingRef}>
          Labels
        </h1>
      </header>

      <p className="list-panel__message">
        A project says where a task belongs; a label says what it needs from you. A task can wear
        several.
      </p>

      <form className="quick-add" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="new-label-name">
          New label
        </label>
        <input
          id="new-label-name"
          className="quick-add__input text-input"
          type="text"
          autoComplete="off"
          placeholder="Add a label"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="button button--primary">
          Add
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="list-panel__message">No labels yet. Add one above, or type one onto a task.</p>
      ) : (
        <ul className="labels-screen__list">
          {rows.map((row) => (
            <LabelRow
              key={row.id}
              row={row}
              onRename={onRename}
              onRecolor={onRecolor}
              onSwap={onSwap}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function LabelRow({
  row,
  onRename,
  onRecolor,
  onSwap,
  onDelete,
}: {
  row: LabelsScreenRow;
  onRename(id: string, name: string): void;
  onRecolor(id: string, colorId: ProjectColor): void;
  onSwap(id: string, withId: string): void;
  onDelete(id: string): void;
}) {
  const [draft, setDraft] = useState(row.name);
  const [confirming, setConfirming] = useState(false);
  const editing = useRef(false);
  const inputId = `label-name-${row.id}`;

  useEffect(() => {
    if (!editing.current) setDraft(row.name);
  }, [row.name]);

  const save = () => {
    editing.current = false;
    const trimmed = draft.trim();
    if (!trimmed) return setDraft(row.name);
    if (trimmed !== row.name) onRename(row.id, trimmed);
  };

  return (
    <li className="labels-screen__row">
      <div className="labels-screen__main">
        <span className="label-mark" data-color={row.colorId} aria-hidden="true" />
        <label className="visually-hidden" htmlFor={inputId}>
          Name of {row.name}
        </label>
        <input
          id={inputId}
          className="text-input labels-screen__name"
          type="text"
          autoComplete="off"
          value={draft}
          onFocus={() => (editing.current = true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <label className="visually-hidden" htmlFor={`${inputId}-color`}>
          Colour of {row.name}
        </label>
        <select
          id={`${inputId}-color`}
          className="text-input"
          value={row.colorId}
          onChange={(event) => onRecolor(row.id, event.target.value as ProjectColor)}
        >
          {PROJECT_COLOR_IDS.map((id) => (
            <option key={id} value={id}>
              {COLOR_NAMES[id]}
            </option>
          ))}
        </select>
      </div>
      <div className="labels-screen__actions">
        <span className="labels-screen__count">
          {row.count === 1 ? '1 open task' : `${row.count} open tasks`}
        </span>
        <a className="labels-screen__link" href={selectionHref({ kind: 'label', labelId: row.id })}>
          Show tasks
        </a>
        {row.above && (
          <button type="button" className="button" onClick={() => onSwap(row.id, row.above!)} aria-label={`Move ${row.name} up`}>
            Up
          </button>
        )}
        {row.below && (
          <button type="button" className="button" onClick={() => onSwap(row.id, row.below!)} aria-label={`Move ${row.name} down`}>
            Down
          </button>
        )}
        {confirming ? (
          <span className="delete-confirm delete-confirm--inline" role="group" aria-label={`Delete ${row.name}?`}>
            <span className="delete-confirm__text">
              {row.count > 0 ? `Take it off its tasks and delete it?` : 'Delete it?'}
            </span>
            <button type="button" className="button" onClick={() => onDelete(row.id)}>
              Delete
            </button>
            <button type="button" className="button" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button type="button" className="button" onClick={() => setConfirming(true)}>
            Delete…
          </button>
        )}
      </div>
    </li>
  );
}
