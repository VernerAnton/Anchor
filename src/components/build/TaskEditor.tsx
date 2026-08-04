import { useState } from 'react';
import type { Priority, Project, Task } from '../../types/task';
import type { PointType } from '../../types/path';
import type { TaskDraft } from '../../store/mutations';
import { useScrollIntoView } from '../../hooks/useScrollIntoView';

interface Props {
  task: Task | null;
  projects: Project[];
  defaultProjectId: string | null;
  onSave: (draft: TaskDraft) => void;
  onCancel: () => void;
}

const PRIORITIES: { value: Priority | null; label: string }[] = [
  { value: 1, label: 'P1' },
  { value: 2, label: 'P2' },
  { value: 3, label: 'P3' },
  { value: 4, label: 'P4' },
  { value: null, label: 'None' },
];

export function TaskEditor({ task, projects, defaultProjectId, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [firstMove, setFirstMove] = useState(task?.firstMove ?? '');
  const [minutes, setMinutes] = useState(
    String(
      task
        ? task.defaultDuration.kind === 'fixed'
          ? task.defaultDuration.minutes
          : task.defaultDuration.estimateMinutes
        : 25,
    ),
  );
  const [natural, setNatural] = useState(task?.defaultDuration.kind === 'natural');
  const [type, setType] = useState<PointType>(task?.type ?? 'physical');
  const [projectId, setProjectId] = useState<string | null>(
    task?.projectId ?? defaultProjectId,
  );
  const [priority, setPriority] = useState<Priority | null>(task?.priority ?? null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Math.max(1, Number(minutes) || 1);
    onSave({
      title: title.trim(),
      firstMove: firstMove.trim() || title.trim(),
      type,
      defaultDuration: natural
        ? { kind: 'natural', estimateMinutes: value }
        : { kind: 'fixed', minutes: value },
      projectId,
      priority,
    });
  };

  return (
    <form className="editor" ref={useScrollIntoView<HTMLFormElement>()} onSubmit={submit}>
      <div className="editor-hd">{task ? 'Edit task' : 'New task'}</div>

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
        <small>What the button says when this is on the route.</small>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Project</span>
          <select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value || null)}>
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Usual minutes</span>
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

      {/*
        Priority orders the backlog and goes no further. It is deliberately not
        copied onto a scheduled point: at the moment of starting, a second axis
        of importance is one more decision, and a visible "low priority" badge
        on something you're about to begin is an invitation to skip it.
      */}
      <div className="field">
        <span>Priority · for sorting here only</span>
        <div className="seg">
          {PRIORITIES.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              className={priority === value ? 'on' : ''}
              onClick={() => setPriority(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-row">
        <button type="submit" className="save">
          {task ? 'Save' : 'Add to library'}
        </button>
        <button type="button" className="cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
