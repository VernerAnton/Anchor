import { useState } from 'react';
import type { Point, PointType } from '../types/path';
import type { PointDraft } from '../store/mutations';
import { toClock } from '../lib/time';
import { useScrollIntoView } from '../hooks/useScrollIntoView';

interface Props {
  /** Absent when adding. */
  point: Point | null;
  defaultStartsAt: number;
  onSave: (draft: PointDraft) => void;
  onCancel: () => void;
}

/**
 * Deliberately the quietest surface in the app.
 *
 * It uses none of the four meaning-carrying colours: ember, acid, cyan and
 * slate all say something specific about where you are on the path, and
 * admin is not a place on the path. Editing should feel subordinate to walking
 * the route, not competitive with it.
 */
export function PointEditor({ point, defaultStartsAt, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(point?.title ?? '');
  const [firstMove, setFirstMove] = useState(point?.firstMove ?? '');
  const [clock, setClock] = useState(toClock(point?.startsAt ?? defaultStartsAt));
  const [minutes, setMinutes] = useState(
    String(
      point
        ? point.duration.kind === 'fixed'
          ? point.duration.minutes
          : point.duration.estimateMinutes
        : 25,
    ),
  );
  const [natural, setNatural] = useState(point?.duration.kind === 'natural');
  const [type, setType] = useState<PointType>(point?.type ?? 'physical');
  const [label, setLabel] = useState(point?.label ?? '');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const [h, m] = clock.split(':').map(Number);
    const startsAt = (h ?? 0) * 60 + (m ?? 0);
    const value = Math.max(1, Number(minutes) || 1);

    onSave({
      title: title.trim(),
      // Falling back to the title keeps the field honest rather than empty, but
      // the point of it is to be smaller than the task.
      firstMove: firstMove.trim() || title.trim(),
      startsAt,
      duration: natural ? { kind: 'natural', estimateMinutes: value } : { kind: 'fixed', minutes: value },
      type,
      label: label.trim() || null,
    });
  };

  return (
    <form className="editor" ref={useScrollIntoView<HTMLFormElement>()} onSubmit={submit}>
      <div className="editor-hd">{point ? 'Edit point' : 'New point'}</div>

      <label className="field">
        <span>The action</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>

      <label className="field">
        <span>Smallest first move</span>
        <input
          value={firstMove}
          onChange={(e) => setFirstMove(e.target.value)}
          placeholder="Pick up the knife"
        />
        <small>What the button will say. Make it small enough to be silly to skip.</small>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Starts</span>
          <input type="time" value={clock} onChange={(e) => setClock(e.target.value)} required />
        </label>
        <label className="field">
          <span>Minutes</span>
          <input
            type="number"
            min="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="seg">
        <button type="button" className={type === 'physical' ? 'on' : ''} onClick={() => setType('physical')}>
          Physical
        </button>
        <button type="button" className={type === 'abstract' ? 'on' : ''} onClick={() => setType('abstract')}>
          Abstract
        </button>
      </div>

      <div className="seg">
        <button type="button" className={!natural ? 'on' : ''} onClick={() => setNatural(false)}>
          Hard stop
        </button>
        <button type="button" className={natural ? 'on' : ''} onClick={() => setNatural(true)}>
          Ends on its own
        </button>
      </div>

      <label className="field">
        <span>Tag (optional)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="MOVEMENT" />
      </label>

      <div className="editor-row">
        <button type="submit" className="save">
          {point ? 'Save' : 'Add to route'}
        </button>
        <button type="button" className="cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
