import { useState } from 'react';
import type { Project, ProjectColor } from '../types/task';
import { PROJECT_COLOR_IDS } from '../types/task';
import { editProject, newProject } from '../store/mutations';

export type ProjectEditorState =
  | { mode: 'new'; parentId: string | null }
  | { mode: 'edit'; project: Project };

interface Props {
  state: ProjectEditorState;
  projects: Project[];
  onSave: (project: Project) => void;
  onDelete: (project: Project) => void;
  onClose: () => void;
}

export function ProjectEditor({ state, projects, onSave, onDelete, onClose }: Props) {
  const editing = state.mode === 'edit' ? state.project : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [colorId, setColorId] = useState<ProjectColor>(editing?.colorId ?? 'steel');
  const [parentId, setParentId] = useState<string | null>(
    editing?.parentId ?? (state.mode === 'new' ? state.parentId : null),
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // One level of nesting: only top-level projects can be parents, and a
  // project with children can't itself be filed under another.
  const hasChildren = editing !== null && projects.some((p) => p.parentId === editing.id);
  const parentOptions = projects.filter(
    (p) => !p.archived && p.parentId === null && p.id !== editing?.id,
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing) {
      onSave(editProject(editing, { name: trimmed, colorId, parentId }));
    } else {
      const order =
        projects.length === 0 ? 0 : Math.max(...projects.map((p) => p.order)) + 1;
      onSave(newProject(trimmed, parentId, order, colorId));
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit project' : 'New project'}
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{editing ? 'Edit project' : 'New project'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            aria-label="Project name"
          />
        </label>

        <fieldset className="field">
          <legend>Colour</legend>
          <div className="field-row swatch-row" role="group" aria-label="Project colour">
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

        {!hasChildren && (
          <label className="field">
            <span>Nest under</span>
            <select
              value={parentId ?? ''}
              onChange={(event) => setParentId(event.target.value || null)}
            >
              <option value="">Top level</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
                onSave(editProject(editing, { archived: !editing.archived }));
                onClose();
              }}
            >
              {editing.archived ? 'Unarchive' : 'Archive'}
            </button>
            {confirmingDelete ? (
              <>
                <span className="detail__confirm">Its tasks move to no project.</span>
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
                Delete project
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
