import { useState } from 'react';
import type { Label, ProjectColor, Task } from '../types/task';
import { PROJECT_COLOR_IDS } from '../types/task';
import { hasLabel } from '../lib/views';

interface Props {
  labels: Label[];
  tasks: Task[];
  onOpenDrawer: () => void;
  /** Show one label's tasks. */
  onOpen: (labelId: string) => void;
  onAdd: (name: string) => void;
  onSave: (label: Label) => void;
  onDelete: (label: Label) => void;
  /** Swap two labels' places in the list. */
  onMove: (label: Label, direction: -1 | 1) => void;
}

/**
 * Every label, and the place they're managed.
 *
 * A screen rather than a list in the sidebar, for the same reason Todoist does
 * it: labels are a small set you arrange occasionally and then stop thinking
 * about, so they don't earn permanent room next to the views you use every
 * day. The sidebar keeps one line; the arranging happens here.
 *
 * Editing is in place. Opening a modal to change a name means leaving the list
 * you're comparing names against, which is the whole reason you came.
 */
export function LabelsPanel({
  labels,
  tasks,
  onOpenDrawer,
  onOpen,
  onAdd,
  onSave,
  onDelete,
  onMove,
}: Props) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const live = labels
    .filter((l) => !l.archived)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft('');
  };

  return (
    <main className="task-panel">
      <header className="panel-header">
        <button
          type="button"
          className="drawer-button"
          aria-label="Open menu"
          onClick={onOpenDrawer}
        >
          ☰
        </button>
        <h1>Labels</h1>
        <span className="panel-header__count">{live.length}</span>
      </header>

      <form className="quick-add" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a label"
          aria-label="New label name"
        />
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>

      {live.length === 0 ? (
        <p className="panel-empty">
          No labels yet. A label is a tag that cuts across projects — what a task needs from you,
          rather than where it belongs.
        </p>
      ) : (
        <ul className="label-rows">
          {live.map((label, index) => (
            <li key={label.id} className="label-row">
              {editingId === label.id ? (
                <LabelForm
                  label={label}
                  onSave={(next) => {
                    onSave(next);
                    setEditingId(null);
                  }}
                  onDelete={() => onDelete(label)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="label-row__face">
                  <button
                    type="button"
                    className="label-row__open brackets"
                    onClick={() => onOpen(label.id)}
                  >
                    <span className="label-chip" data-color={label.colorId} aria-hidden="true" />
                    <span className="label-row__name">{label.name}</span>
                    <span className="badge">
                      {tasks.filter((t) => !t.archived && t.completedAt === null && hasLabel(t, label.id)).length}
                    </span>
                  </button>

                  <div className="label-row__tools">
                    <button
                      type="button"
                      className="entry-tools__button"
                      disabled={index === 0}
                      aria-label={`Move ${label.name} up`}
                      onClick={() => onMove(label, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="entry-tools__button"
                      disabled={index === live.length - 1}
                      aria-label={`Move ${label.name} down`}
                      onClick={() => onMove(label, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="entry-tools__button"
                      aria-label={`Edit ${label.name}`}
                      onClick={() => setEditingId(label.id)}
                    >
                      ✎
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Name, colour and delete, expanded into the row rather than over it. */
function LabelForm({
  label,
  onSave,
  onDelete,
  onCancel,
}: {
  label: Label;
  onSave: (label: Label) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [colorId, setColorId] = useState<ProjectColor>(label.colorId);
  const [confirming, setConfirming] = useState(false);

  return (
    <form
      className="label-row__form"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onSave({ ...label, name: trimmed, colorId });
      }}
    >
      <div className="field-row">
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Label name"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancel();
          }}
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          Save
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="field-row swatch-row" role="group" aria-label="Label colour">
        {PROJECT_COLOR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="swatch"
            data-color={id}
            aria-label={id}
            aria-pressed={colorId === id}
            onClick={() => setColorId(id)}
          />
        ))}
      </div>

      <div className="field-row">
        {confirming ? (
          <>
            <span className="detail__confirm">It comes off every task that carries it.</span>
            <button type="button" className="btn btn--destructive" onClick={onDelete}>
              Delete
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--quiet" onClick={() => setConfirming(true)}>
            Delete label
          </button>
        )}
      </div>
    </form>
  );
}
