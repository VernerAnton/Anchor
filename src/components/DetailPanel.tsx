import { useState } from 'react';
import type { Project, Recurrence, Task } from '../types/task';
import type { TaskDraft } from '../store/mutations';
import { PRIORITIES } from '../lib/priorities';
import { RecurrenceEditor } from './RecurrenceEditor';

interface Props {
  task: Task | null;
  tasks: Task[];
  projects: Project[];
  today: string;
  onClose: () => void;
  onUpdate: (task: Task, changes: Partial<TaskDraft>) => void;
  /**
   * Separate from `onUpdate` because setting a rule also stamps its anchor,
   * which is a rule of the model rather than a plain field write.
   */
  onSetRecurrence: (task: Task, recurrence: Recurrence | null) => void;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddSubtask: (parent: Task, title: string) => void;
  onSelectTask: (id: string) => void;
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
  today,
  onClose,
  onUpdate,
  onSetRecurrence,
  onToggle,
  onDelete,
  onAddSubtask,
  onSelectTask,
}: Props & { task: Task }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
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
