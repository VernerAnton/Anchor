import { useState } from 'react';
import type { PathEntry } from '../types/path';
import type { LandingTask } from '../lib/day';
import { restEntry, taskEntry, wildcardEntry } from '../store/mutations';
import { NumberField } from './NumberField';
import { TaskPicker } from './TaskPicker';

/**
 * What a drag is carrying. Custom types rather than `text/plain` so the gap
 * can tell a task arriving from the library apart from an entry being moved
 * within the day, and can say no to anything else dropped on it.
 *
 * Only the type is readable while a drag is in flight, which is exactly what
 * the highlight needs; the payload is read on drop.
 */
export const TASK_DRAG = 'application/x-anchor-task';
export const ENTRY_DRAG = 'application/x-anchor-entry';

interface Props {
  /** Where an insert lands, and the gap a move drops into. */
  index: number;
  /** What this day already offers — a task's rule decides, not this control. */
  landing: LandingTask[];
  onInsert: (index: number, entry: PathEntry) => void;
  onMove: (from: number, to: number) => void;
}

/**
 * The gap between two things on the day, and the only way anything gets onto
 * it.
 *
 * A gap does two jobs with one target. Pressing `+` opens the three things a
 * day can hold; dragging something over it drops that thing here. They are the
 * same position and the same result, which is what keeps the whole builder
 * reachable without a drag — drag is a shortcut on a desktop, never the only
 * route, because it isn't one on a phone at all.
 */
export function PathInsert({ index, landing, onInsert, onMove }: Props) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);

  const accepts = (event: React.DragEvent) =>
    event.dataTransfer.types.includes(TASK_DRAG) || event.dataTransfer.types.includes(ENTRY_DRAG);

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    setOver(false);
    const taskId = event.dataTransfer.getData(TASK_DRAG);
    if (taskId) {
      onInsert(index, taskEntry(taskId));
      return;
    }
    const from = Number(event.dataTransfer.getData(ENTRY_DRAG));
    if (Number.isInteger(from)) onMove(from, index);
  };

  const classes = ['path-gap__control'];
  if (open) classes.push('path-gap__control--open');
  if (over) classes.push('path-gap__control--over');

  return (
    <div
      className={classes.join(' ')}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        // Without this the browser refuses the drop and animates it back.
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <button
        type="button"
        className="path-gap__add"
        aria-expanded={open}
        aria-label={open ? 'Close the insert menu' : 'Add something here'}
        onClick={() => setOpen(!open)}
      >
        +
      </button>

      {open && (
        <InsertMenu
          landing={landing}
          onPick={(entry) => {
            onInsert(index, entry);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

type Mode = 'choose' | 'task' | 'rest' | 'wildcard';

/**
 * The three things a day can hold, in the order you reach for them.
 *
 * Opens in place rather than floating over the day: a menu pinned to a gap
 * halfway down a scrolling list has to be positioned, re-positioned when the
 * list moves, and flipped when it runs off the bottom — and none of that
 * survives a phone. Pushing the day down instead is one line of layout and
 * behaves the same everywhere.
 */
function InsertMenu({
  landing,
  onPick,
  onCancel,
}: {
  landing: LandingTask[];
  onPick: (entry: PathEntry) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('choose');

  return (
    <div
      className="insert-menu"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        if (mode === 'choose') onCancel();
        else setMode('choose');
      }}
    >
      {mode === 'choose' && (
        <div className="insert-menu__choices">
          <button type="button" className="pick" onClick={() => setMode('task')}>
            Task
          </button>
          <button type="button" className="pick" onClick={() => setMode('rest')}>
            Rest
          </button>
          <button type="button" className="pick" onClick={() => setMode('wildcard')}>
            Wildcard
          </button>
        </div>
      )}

      {mode === 'task' && (
        <TaskPicker
          landing={landing}
          emptyNote="Nothing else lands on this day. Change how often something repeats on the task itself, or drop it in a wildcard."
          onPick={(taskId) => onPick(taskEntry(taskId))}
          onCancel={() => setMode('choose')}
        />
      )}

      {mode === 'rest' && (
        <RestForm
          onSubmit={(label, minutes) => onPick(restEntry(label, minutes))}
          onCancel={() => setMode('choose')}
        />
      )}

      {mode === 'wildcard' && (
        <WildcardForm
          onSubmit={(startTime, minutes) => onPick(wildcardEntry(startTime, minutes))}
          onCancel={() => setMode('choose')}
        />
      )}
    </div>
  );
}

function RestForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (label: string | null, minutes: number) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState(30);

  return (
    <form
      className="insert-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(label.trim() === '' ? null : label.trim(), minutes);
      }}
    >
      <label className="field">
        <span>What you're doing with it</span>
        <input
          autoFocus
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Shower, eat — or leave it blank"
        />
      </label>
      <div className="field-row">
        <NumberField value={minutes} min={5} max={720} label="Minutes" onCommit={setMinutes} />
        <button type="submit" className="btn btn--primary">
          Add rest
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Back
        </button>
      </div>
    </form>
  );
}

function WildcardForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (startTime: string | null, minutes: number) => void;
  onCancel: () => void;
}) {
  const [startTime, setStartTime] = useState('');
  const [minutes, setMinutes] = useState(45);

  return (
    <form
      className="insert-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(startTime === '' ? null : startTime, minutes);
      }}
    >
      <p className="insert-form__note">
        Time you've already set aside for whatever the week turns up. Left empty it reads as open
        time — it never asks you for anything.
      </p>
      <div className="field-row">
        <label className="field">
          <span>Starts at</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <NumberField
          value={minutes}
          min={5}
          max={720}
          label="Minutes"
          onCommit={setMinutes}
        />
      </div>
      <div className="field-row">
        <button type="submit" className="btn btn--primary">
          Add wildcard
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Back
        </button>
      </div>
    </form>
  );
}
