import { useState } from 'react';
import type { Label, ProjectColor } from '../types/task';
import { PROJECT_COLOR_IDS } from '../types/task';
import { editLabel, newLabel } from '../store/mutations';

export type LabelEditorState = { mode: 'new' } | { mode: 'edit'; label: Label };

interface Props {
  state: LabelEditorState;
  labels: Label[];
  onSave: (label: Label) => void;
  onDelete: (label: Label) => void;
  onClose: () => void;
}

/**
 * A label has a name and a colour, and that is the whole of it.
 *
 * No nesting, deliberately. Projects nest because a body of work has parts; a
 * tag that needs a parent is a project wearing the wrong hat, and the moment
 * labels grow a hierarchy there are two answers to "where does this live".
 *
 * Colours come from the same muted set as projects — identity is one axis, and
 * splitting it in two would mean inventing a second palette that has to stay
 * distinguishable from the first for no gain. What tells them apart is shape:
 * a project is a dot, a label is an outlined chip.
 */
export function LabelEditor({ state, labels, onSave, onDelete, onClose }: Props) {
  const editing = state.mode === 'edit' ? state.label : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [colorId, setColorId] = useState<ProjectColor>(editing?.colorId ?? 'steel');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing) {
      onSave(editLabel(editing, { name: trimmed, colorId }));
    } else {
      const order = labels.length === 0 ? 0 : Math.max(...labels.map((l) => l.order)) + 1;
      onSave(newLabel(trimmed, order, colorId));
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit label' : 'New label'}
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{editing ? 'Edit label' : 'New label'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            aria-label="Label name"
          />
        </label>

        <fieldset className="field">
          <legend>Colour</legend>
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
        </fieldset>

        <div className="field-row modal__actions">
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            {editing ? 'Save' : 'Create'}
          </button>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Cancel
          </button>
        </div>

        {editing && (
          <div className="field-row modal__danger">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                onSave(editLabel(editing, { archived: !editing.archived }));
                onClose();
              }}
            >
              {editing.archived ? 'Unarchive' : 'Archive'}
            </button>
            {confirmingDelete ? (
              <>
                <span className="detail__confirm">It comes off every task that carries it.</span>
                <button
                  type="button"
                  className="btn btn--destructive"
                  onClick={() => {
                    onDelete(editing);
                    onClose();
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete label
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
