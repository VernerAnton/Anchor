import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Priority } from '../types/task';
import type { TaskDetailModel } from '../lib/views';

export interface TaskChanges {
  title?: string;
  notes?: string | null;
  dueDate?: string | null;
  priority?: Priority | null;
}

interface Props {
  detail: TaskDetailModel;
  /** The narrow layout, where the panel covers the list instead of sitting beside it. */
  overlay: boolean;
  onClose(): void;
  onOpen(id: string): void;
  onToggle(id: string, done: boolean): void;
  onUpdate(id: string, changes: TaskChanges): void;
  onSetProject(id: string, projectId: string | null): void;
  onAddSubtask(parentId: string, title: string): void;
  onDelete(id: string): void;
}

const PRIORITIES: Priority[] = [1, 2, 3, 4];

/**
 * A text field's local copy while it's being edited. Saved on blur, so typing
 * isn't a write per keystroke; refreshed from the store whenever the field
 * isn't focused, so an edit from another tab still shows up.
 */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  return {
    draft,
    setDraft,
    isEditing: () => editing.current,
    onFocus: () => (editing.current = true),
    onBlurDone: () => (editing.current = false),
  };
}

/**
 * One task, in full, editable in place. Keyed by task id by its parent, so
 * opening a different task starts fresh — a half-finished delete confirm or
 * an unsaved draft never carries over.
 */
export function DetailPanel({
  detail,
  overlay,
  onClose,
  onOpen,
  onToggle,
  onUpdate,
  onSetProject,
  onAddSubtask,
  onDelete,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const title = useDraft(detail.title);
  const notes = useDraft(detail.notes);
  const done = detail.status === 'done';
  const subtaskCount = detail.subtasks?.length ?? 0;

  // Opening a task moves focus to it, so a keyboard user lands where the
  // content just appeared rather than back at the list.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);


  const saveTitle = () => {
    title.onBlurDone();
    const trimmed = title.draft.trim();
    // An empty title isn't a task; put the old one back rather than save it.
    if (!trimmed) return title.setDraft(detail.title);
    if (trimmed !== detail.title) onUpdate(detail.id, { title: trimmed });
  };

  const saveNotes = () => {
    notes.onBlurDone();
    const value = notes.draft.trim() === '' ? null : notes.draft;
    if (value !== (detail.notes === '' ? null : detail.notes)) onUpdate(detail.id, { notes: value });
  };

  // Closing the panel mid-edit (Escape, or opening another task) removes the
  // field without a reliable blur. Whatever was typed is saved on the way out.
  const pendingSaves = useRef<() => void>(() => {});
  pendingSaves.current = () => {
    if (title.isEditing()) saveTitle();
    if (notes.isEditing()) saveNotes();
  };
  useEffect(() => () => pendingSaves.current(), []);

  const addSubtask = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = subtaskDraft.trim();
    if (!trimmed) return;
    onAddSubtask(detail.id, trimmed);
    setSubtaskDraft('');
  };

  const startConfirm = () => {
    setConfirming(true);
    queueMicrotask(() => keepRef.current?.focus());
  };

  const cancelConfirm = () => {
    setConfirming(false);
    queueMicrotask(() => deleteRef.current?.focus());
  };

  // Escape backs out of the confirm first; only an Escape with nothing to
  // back out of reaches the app and closes the panel.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && confirming) {
      event.stopPropagation();
      cancelConfirm();
    }
  };

  const classes = ['detail-panel'];
  if (overlay) classes.push('detail-panel--overlay');

  return (
    <aside className={classes.join(' ')} aria-labelledby="detail-heading" onKeyDown={onKeyDown}>
      <header className="detail-panel__header">
        <h2 id="detail-heading" className="detail-panel__heading" tabIndex={-1} ref={headingRef}>
          {detail.parent ? 'Subtask' : 'Task'}
        </h2>
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      </header>

      {detail.parent && (
        <p className="detail-panel__parent">
          Part of{' '}
          <button type="button" className="link-button" onClick={() => onOpen(detail.parent!.id)}>
            {detail.parent.title}
          </button>
        </p>
      )}

      <div className="field">
        <label className="field__label" htmlFor="detail-title">
          Title
        </label>
        <input
          id="detail-title"
          className="text-input detail-panel__title-input"
          type="text"
          autoComplete="off"
          value={title.draft}
          onFocus={title.onFocus}
          onChange={(event) => title.setDraft(event.target.value)}
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </div>

      <div className="detail-panel__status">
        <button
          type="button"
          className="button button--primary"
          onClick={() => onToggle(detail.id, !done)}
        >
          {done ? 'Reopen' : 'Mark done'}
        </button>
        <span className="detail-panel__status-text">{detail.completedLabel ?? 'Open'}</span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="detail-due">
          Due date
        </label>
        <div className="field__row">
          <input
            id="detail-due"
            className="text-input"
            type="date"
            value={detail.dueDate ?? ''}
            onChange={(event) => onUpdate(detail.id, { dueDate: event.target.value || null })}
          />
          {detail.dueDate !== null && (
            <button type="button" className="button" onClick={() => onUpdate(detail.id, { dueDate: null })}>
              Clear date
            </button>
          )}
        </div>
      </div>

      <fieldset className="field">
        <legend className="field__label">Priority</legend>
        <div className="button-row" role="group">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className="button priority-choice"
              data-priority={p}
              aria-pressed={detail.priority === p}
              // Pressing the current priority clears it.
              onClick={() => onUpdate(detail.id, { priority: detail.priority === p ? null : p })}
            >
              P{p}
            </button>
          ))}
        </div>
        <p className="field__hint">
          {detail.priority === null
            ? 'None set.'
            : `Press P${detail.priority} again to clear it.`}
        </p>
      </fieldset>

      <div className="field">
        {detail.parent ? (
          <>
            <span className="field__label">Project</span>
            <p className="field__value">
              {detail.projectName ?? 'No project'} — subtasks stay with their parent.
            </p>
          </>
        ) : (
          <>
            <label className="field__label" htmlFor="detail-project">
              Project
            </label>
            <select
              id="detail-project"
              className="text-input"
              value={detail.projectId ?? ''}
              onChange={(event) => onSetProject(detail.id, event.target.value || null)}
            >
              <option value="">No project</option>
              {detail.projectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.depth === 1 ? ` ${option.name}` : option.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="detail-notes">
          Notes
        </label>
        <textarea
          id="detail-notes"
          className="text-input detail-panel__notes"
          rows={4}
          value={notes.draft}
          onFocus={notes.onFocus}
          onChange={(event) => notes.setDraft(event.target.value)}
          onBlur={saveNotes}
        />
      </div>

      {detail.subtasks !== null && (
        <section className="field" aria-labelledby="detail-subtasks">
          <h3 id="detail-subtasks" className="field__label">
            Subtasks
          </h3>
          {detail.subtasks.length > 0 && (
            <ul className="detail-subtasks">
              {detail.subtasks.map((sub) => (
                <li key={sub.id} className={`detail-subtasks__item task-row--${sub.status}`}>
                  <input
                    type="checkbox"
                    className="task-row__check"
                    checked={sub.status === 'done'}
                    onChange={() => onToggle(sub.id, sub.status !== 'done')}
                    aria-label={`Done: ${sub.title}`}
                  />
                  <button type="button" className="link-button task-row__title" onClick={() => onOpen(sub.id)}>
                    {sub.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="quick-add" onSubmit={addSubtask}>
            <label className="visually-hidden" htmlFor="detail-new-subtask">
              New subtask
            </label>
            <input
              id="detail-new-subtask"
              className="quick-add__input text-input"
              type="text"
              autoComplete="off"
              placeholder="Add a subtask"
              value={subtaskDraft}
              onChange={(event) => setSubtaskDraft(event.target.value)}
            />
            <button type="submit" className="button">
              Add
            </button>
          </form>
        </section>
      )}

      <div className="detail-panel__danger">
        {confirming ? (
          <div className="delete-confirm" role="group" aria-labelledby="delete-confirm-text">
            <p id="delete-confirm-text" className="delete-confirm__text">
              {subtaskCount > 0
                ? `Delete this task and its ${subtaskCount === 1 ? 'subtask' : `${subtaskCount} subtasks`}? They can’t be brought back.`
                : 'Delete this task? It can’t be brought back.'}
            </p>
            <div className="button-row">
              <button type="button" className="button" onClick={() => onDelete(detail.id)}>
                Delete
              </button>
              <button type="button" className="button" ref={keepRef} onClick={cancelConfirm}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button" ref={deleteRef} onClick={startConfirm}>
            Delete…
          </button>
        )}
      </div>
    </aside>
  );
}

/** The wide layout's third column when nothing is open. */
export function DetailPlaceholder() {
  return (
    <aside className="detail-panel detail-panel--empty" aria-label="Task details">
      <p className="detail-panel__message">Choose a task to see it here.</p>
    </aside>
  );
}
