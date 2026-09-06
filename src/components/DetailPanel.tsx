import { useState } from 'react';
import type { Duration, Label, Project, Recurrence, Task, TaskType } from '../types/task';
import type { TaskDraft } from '../store/mutations';
import { PRIORITIES } from '../lib/priorities';
import { DEFAULT_MINUTES } from '../lib/day';
import { rescheduleOptions } from '../lib/reschedule';
import { RecurrenceEditor } from './RecurrenceEditor';
import { NumberField } from './NumberField';

interface Props {
  task: Task | null;
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  today: string;
  onClose: () => void;
  onUpdate: (task: Task, changes: Partial<TaskDraft>) => void;
  /**
   * Separate from `onUpdate` because setting a rule also stamps its anchor,
   * which is a rule of the model rather than a plain field write.
   */
  onSetRecurrence: (task: Task, recurrence: Recurrence | null) => void;
  /**
   * Also separate from `onUpdate`: moving a task moves the phase its rule
   * counts from, which a plain `dueDate` write would leave behind.
   */
  onReschedule: (task: Task, date: string) => void;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddSubtask: (parent: Task, title: string) => void;
  onSelectTask: (id: string) => void;
  /** Adds or removes one label. A press is the whole interaction. */
  onToggleLabel: (task: Task, labelId: string) => void;
}

export function DetailPanel(props: Props) {
  const { task } = props;
  return (
    <aside className={task ? 'detail detail--open' : 'detail'} aria-label="Task details">
      {task === null ? (
        <p className="detail__empty">Select a task to see its details.</p>
      ) : (
        <TaskForm key={task.id} {...props} task={task} />
      )}
    </aside>
  );
}

function TaskForm({
  task,
  tasks,
  projects,
  labels,
  today,
  onClose,
  onUpdate,
  onSetRecurrence,
  onReschedule,
  onToggle,
  onDelete,
  onAddSubtask,
  onSelectTask,
  onToggleLabel,
}: Props & { task: Task }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [firstMove, setFirstMove] = useState(task.firstMove ?? '');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const parent = task.parentId ? (tasks.find((t) => t.id === task.parentId) ?? null) : null;
  const subtasks = tasks
    .filter((t) => t.parentId === task.id && !t.archived)
    .sort((a, b) => a.order - b.order);
  const done = task.completedAt !== null;

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate(task, { title: trimmed });
    } else {
      setTitle(task.title);
    }
  };

  const commitNotes = () => {
    const value = notes.trim() === '' ? null : notes;
    if (value !== task.notes) onUpdate(task, { notes: value });
  };

  const commitFirstMove = () => {
    const value = firstMove.trim() === '' ? null : firstMove.trim();
    if (value !== task.firstMove) onUpdate(task, { firstMove: value });
  };

  /** Pressing the active one clears it, matching the priority picker above. */
  const setType = (type: TaskType) => {
    onUpdate(task, { type: task.type === type ? null : type });
  };

  const duration = task.defaultDuration;

  const setDurationKind = (kind: Duration['kind']) => {
    if (duration?.kind === kind) {
      onUpdate(task, { defaultDuration: null });
      return;
    }
    // The minutes carry across a kind switch, so toggling between the two
    // while deciding doesn't discard what was already typed.
    const minutes = duration
      ? duration.kind === 'fixed'
        ? duration.minutes
        : duration.estimateMinutes
      : DEFAULT_MINUTES;
    onUpdate(task, {
      defaultDuration: kind === 'fixed' ? { kind, minutes } : { kind, estimateMinutes: minutes },
    });
  };

  const setDurationMinutes = (minutes: number) => {
    if (!duration) return;
    onUpdate(task, {
      defaultDuration:
        duration.kind === 'fixed'
          ? { kind: 'fixed', minutes }
          : { kind: 'natural', estimateMinutes: minutes },
    });
  };

  const submitSubtask = (event: React.FormEvent) => {
    event.preventDefault();
    const value = subtaskDraft.trim();
    if (!value) return;
    onAddSubtask(task, value);
    setSubtaskDraft('');
  };

  return (
    <div className="detail__inner">
      <header className="detail__head">
        {parent ? (
          <button type="button" className="detail__crumb" onClick={() => onSelectTask(parent.id)}>
            ← {parent.title}
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="row-action" aria-label="Close details" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="detail__status">
        <button
          type="button"
          className="task-check"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={() => onToggle(task)}
        />
        <input
          className="detail__title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
          aria-label="Task title"
        />
      </div>

      {/*
        Directly under the title, above everything you'd have to read to
        decide. Moving a thing is the commonest edit a task ever gets, and it
        shouldn't cost a trip to a date picker. Hidden once it's done: a
        completed task with a future due date is a state nothing else in the
        app can produce, and nothing should start.
      */}
      {!done && (
        <div className="reschedule" role="group" aria-label="Move this task">
          {rescheduleOptions(task, today).map((option) => (
            <button
              key={option.id}
              type="button"
              className="reschedule__option"
              /* Where the task already sits. The press is otherwise invisible
                 until you scroll to the date field, and a button that seems to
                 do nothing gets pressed again. */
              aria-current={task.dueDate === option.date}
              onClick={() => onReschedule(task, option.date)}
            >
              <span className="reschedule__label">{option.label}</span>
              <span className="reschedule__date">{option.dateLabel}</span>
            </button>
          ))}
        </div>
      )}

      <label className="field">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={commitNotes}
          rows={4}
          placeholder="Anything worth writing down"
        />
      </label>

      <label className="field">
        <span>Project</span>
        <select
          value={task.projectId ?? ''}
          onChange={(event) => onUpdate(task, { projectId: event.target.value || null })}
        >
          <option value="">None</option>
          {projects
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>

      <label className="field">
        <span>Due date</span>
        <div className="field-row">
          <input
            type="date"
            value={task.dueDate ?? ''}
            onChange={(event) => onUpdate(task, { dueDate: event.target.value || null })}
          />
          {task.dueDate !== null && (
            <button type="button" className="btn btn--quiet" onClick={() => onUpdate(task, { dueDate: null })}>
              Clear
            </button>
          )}
        </div>
      </label>

      {/*
        Every label at once rather than a picker that opens: there are few
        enough of them to show, and seeing which are off is half of what you
        came here for. A project answers where this belongs; labels answer
        what it needs from you, and a task can carry any number of them.
      */}
      <fieldset className="field">
        <legend>Labels</legend>
        {labels.filter((l) => !l.archived).length === 0 ? (
          <p className="sync-note">No labels yet. Make one from the sidebar.</p>
        ) : (
          <div className="field-row label-picker">
            {labels
              .filter((l) => !l.archived)
              .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name)))
              .map((label) => (
                <button
                  key={label.id}
                  type="button"
                  className="label-pick"
                  data-color={label.colorId}
                  aria-pressed={(task.labelIds ?? []).includes(label.id)}
                  onClick={() => onToggleLabel(task, label.id)}
                >
                  {label.name}
                </button>
              ))}
          </div>
        )}
      </fieldset>

      <fieldset className="field">
        <legend>Priority</legend>
        <div className="field-row priority-picker">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className="priority-flag priority-flag--pick"
              data-priority={p}
              aria-pressed={task.priority === p}
              onClick={() => onUpdate(task, { priority: task.priority === p ? null : p })}
            >
              P{p}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Type</legend>
        <div className="field-row">
          <button
            type="button"
            className="pick"
            aria-pressed={task.type === 'physical'}
            onClick={() => setType('physical')}
          >
            Physical
          </button>
          <button
            type="button"
            className="pick"
            aria-pressed={task.type === 'abstract'}
            onClick={() => setType('abstract')}
          >
            Abstract
          </button>
        </div>
      </fieldset>

      <label className="field">
        <span>First move</span>
        <input
          value={firstMove}
          onChange={(event) => setFirstMove(event.target.value)}
          onBlur={commitFirstMove}
          placeholder="The smallest thing that starts it"
        />
      </label>

      <fieldset className="field">
        <legend>Duration</legend>
        <div className="field-row">
          <button
            type="button"
            className="pick"
            aria-pressed={duration?.kind === 'fixed'}
            onClick={() => setDurationKind('fixed')}
          >
            Fixed
          </button>
          <button
            type="button"
            className="pick"
            aria-pressed={duration?.kind === 'natural'}
            onClick={() => setDurationKind('natural')}
          >
            Runs to completion
          </button>
          {duration && (
            <NumberField
              value={duration.kind === 'fixed' ? duration.minutes : duration.estimateMinutes}
              min={1}
              max={720}
              label={duration.kind === 'fixed' ? 'Minutes' : 'Estimated minutes'}
              onCommit={setDurationMinutes}
            />
          )}
        </div>
      </fieldset>

      <RecurrenceEditor
        recurrence={task.recurrence}
        from={task.dueDate ?? today}
        onChange={(recurrence) => onSetRecurrence(task, recurrence)}
      />

      {task.parentId === null && (
        <section className="field">
          <h2 className="field__title">Subtasks</h2>
          {subtasks.length > 0 && (
            <ul className="detail__subtasks">
              {subtasks.map((sub) => (
                <li key={sub.id}>
                  <button
                    type="button"
                    className="task-check"
                    role="checkbox"
                    aria-checked={sub.completedAt !== null}
                    aria-label={
                      sub.completedAt !== null ? `Reopen ${sub.title}` : `Complete ${sub.title}`
                    }
                    onClick={() => onToggle(sub)}
                  />
                  <button
                    type="button"
                    className={
                      sub.completedAt !== null
                        ? 'detail__subtask-title detail__subtask-title--done'
                        : 'detail__subtask-title'
                    }
                    onClick={() => onSelectTask(sub.id)}
                  >
                    {sub.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="quick-add quick-add--sub" onSubmit={submitSubtask}>
            <input
              value={subtaskDraft}
              onChange={(event) => setSubtaskDraft(event.target.value)}
              placeholder="Add a subtask"
              aria-label="New subtask title"
            />
            <button type="submit" disabled={!subtaskDraft.trim()}>
              Add
            </button>
          </form>
        </section>
      )}

      <footer className="detail__foot">
        {confirmingDelete ? (
          <div className="field-row">
            <span className="detail__confirm">
              Delete this task{subtasks.length > 0 ? ' and its subtasks' : ''}?
            </span>
            <button type="button" className="btn btn--destructive" onClick={() => onDelete(task)}>
              Delete
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setConfirmingDelete(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--quiet" onClick={() => setConfirmingDelete(true)}>
            Delete task
          </button>
        )}
      </footer>
    </div>
  );
}
