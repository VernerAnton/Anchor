import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PROJECT_COLOR_IDS, type ProjectColor } from '../types/task';
import type { ProjectEditorModel } from '../lib/projects';

export interface ProjectChanges {
  name: string;
  colorId: ProjectColor;
  parentId: string | null;
}

interface Props {
  model: ProjectEditorModel;
  onSave(changes: ProjectChanges): void;
  onArchive(archived: boolean): void;
  onDelete(): void;
  onClose(): void;
}

/** Names for the colour ids, shown beside each swatch so the choice reads with no theme. */
const COLOR_NAMES: Record<ProjectColor, string> = {
  steel: 'Steel',
  violet: 'Violet',
  teal: 'Teal',
  sage: 'Sage',
  ochre: 'Ochre',
  plum: 'Plum',
  indigo: 'Indigo',
  clay: 'Clay',
};

/**
 * A project's settings, edited in place above its own list rather than in a
 * modal — the list you're filing into stays in view while you rename it.
 */
export function ProjectEditor({ model, onSave, onArchive, onDelete, onClose }: Props) {
  const [name, setName] = useState(model.name);
  const [colorId, setColorId] = useState<ProjectColor>(model.colorId);
  const [parentId, setParentId] = useState<string | null>(model.parentId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, colorId, parentId });
  };

  return (
    <form
      className="project-editor"
      aria-label="Edit project"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="field">
        <label className="field__label" htmlFor="project-name">
          Name
        </label>
        <input
          id="project-name"
          ref={nameRef}
          className="text-input"
          type="text"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <fieldset className="field">
        <legend className="field__label">Colour</legend>
        <div className="color-choices">
          {PROJECT_COLOR_IDS.map((id) => (
            <label key={id} className="color-choice">
              <input
                type="radio"
                name="project-color"
                value={id}
                checked={colorId === id}
                onChange={() => setColorId(id)}
              />
              <span className="project-dot" data-color={id} aria-hidden="true" />
              {COLOR_NAMES[id]}
            </label>
          ))}
        </div>
      </fieldset>

      {model.parentOptions.length > 0 || model.parentId !== null ? (
        <div className="field">
          <label className="field__label" htmlFor="project-parent">
            Inside
          </label>
          <select
            id="project-parent"
            className="text-input"
            value={parentId ?? ''}
            onChange={(event) => setParentId(event.target.value || null)}
          >
            <option value="">Nothing — top level</option>
            {model.parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="button-row">
        <button type="submit" className="button button--primary">
          Save
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="project-editor__danger">
        <button type="button" className="button" onClick={() => onArchive(!model.archived)}>
          {model.archived ? 'Unarchive project' : 'Archive project'}
        </button>
        {model.deletable &&
          (confirmingDelete ? (
            <div className="delete-confirm" role="group" aria-labelledby="project-delete-text">
              <p id="project-delete-text" className="delete-confirm__text">
                Delete this project? Nothing is filed under it.
              </p>
              <div className="button-row">
                <button type="button" className="button" onClick={onDelete}>
                  Delete
                </button>
                <button type="button" className="button" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="button" onClick={() => setConfirmingDelete(true)}>
              Delete project…
            </button>
          ))}
      </div>
    </form>
  );
}
