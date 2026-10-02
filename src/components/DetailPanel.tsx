import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { TaskDetailModel } from '../lib/views';

interface Props {
  detail: TaskDetailModel;
  /** The narrow layout, where the panel covers the list instead of sitting beside it. */
  overlay: boolean;
  onClose(): void;
  onToggle(id: string, done: boolean): void;
  onDelete(id: string): void;
}

/**
 * One task, in full. Keyed by task id by its parent, so opening a different
 * task starts fresh — a half-finished delete confirm never carries over.
 */
export function DetailPanel({ detail, overlay, onClose, onToggle, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const done = detail.status === 'done';

  // Opening a task moves focus to it, so a keyboard user lands where the
  // content just appeared rather than back at the list.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

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
        <h2 id="detail-heading" className="detail-panel__title" tabIndex={-1} ref={headingRef}>
          {detail.title}
        </h2>
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      </header>

      <p className="detail-panel__status">{done ? 'Done' : 'Open'}</p>

      <div className="button-row">
        <button
          type="button"
          className="button button--primary"
          onClick={() => onToggle(detail.id, !done)}
        >
          {done ? 'Reopen' : 'Mark done'}
        </button>

        {!confirming && (
          <button type="button" className="button" ref={deleteRef} onClick={startConfirm}>
            Delete…
          </button>
        )}
      </div>

      {confirming && (
        <div className="delete-confirm" role="group" aria-labelledby="delete-confirm-text">
          <p id="delete-confirm-text" className="delete-confirm__text">
            Delete this task? It can’t be brought back.
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
      )}
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
