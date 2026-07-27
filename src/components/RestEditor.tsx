import { useState } from 'react';
import type { Rest } from '../types/path';
import { useScrollIntoView } from '../hooks/useScrollIntoView';

interface Props {
  rest: Rest | null;
  onSave: (minutes: number, label: string | null) => void;
  onCancel: () => void;
}

/**
 * Rest is editable — how long it runs and what it's for are yours to set. What
 * stays impossible is finishing it, so there is no completion control here and
 * nothing that would produce one.
 */
export function RestEditor({ rest, onSave, onCancel }: Props) {
  const [minutes, setMinutes] = useState(String(rest?.minutes ?? 15));
  const [label, setLabel] = useState(rest?.label ?? '');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(Math.max(1, Number(minutes) || 1), label.trim() || null);
  };

  return (
    <form className="editor" ref={useScrollIntoView<HTMLFormElement>()} onSubmit={submit}>
      <div className="editor-hd">{rest ? 'Edit rest' : 'New rest'}</div>

      <div className="field-row">
        <label className="field">
          <span>Minutes</span>
          <input
            type="number"
            min="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>What for (optional)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="COFFEE" />
        </label>
      </div>

      <div className="editor-row">
        <button type="submit" className="save">
          {rest ? 'Save' : 'Add to route'}
        </button>
        <button type="button" className="cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
