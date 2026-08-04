import { useState } from 'react';
import type { Project, ProjectColor } from '../../types/task';
import { PROJECT_COLORS, PROJECT_COLOR_IDS } from '../../types/task';
import { useScrollIntoView } from '../../hooks/useScrollIntoView';

interface Props {
  project: Project | null;
  onSave: (name: string, colorId: ProjectColor) => void;
  onCancel: () => void;
}

export function ProjectEditor({ project, onSave, onCancel }: Props) {
  const [name, setName] = useState(project?.name ?? '');
  const [colorId, setColorId] = useState<ProjectColor>(project?.colorId ?? 'steel');

  return (
    <form
      className="editor"
      ref={useScrollIntoView<HTMLFormElement>()}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSave(name.trim(), colorId);
      }}
    >
      <div className="editor-hd">{project ? 'Edit project' : 'New project'}</div>

      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>

      <div className="field">
        <span>Colour</span>
        <div className="swatches">
          {PROJECT_COLOR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`swatch${colorId === id ? ' on' : ''}`}
              style={{ background: PROJECT_COLORS[id] }}
              onClick={() => setColorId(id)}
              aria-label={id}
              aria-pressed={colorId === id}
            />
          ))}
        </div>
      </div>

      <div className="editor-row">
        <button type="submit" className="save">
          {project ? 'Save' : 'Create'}
        </button>
        <button type="button" className="cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
