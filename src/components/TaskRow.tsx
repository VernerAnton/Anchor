import type { Label, Project, Task } from '../types/task';
import { describeRecurrence } from '../lib/recurrence';
import { taskRef } from '../lib/taskRef';
import { dateLabel, type Selection } from '../lib/views';

interface Props {
  task: Task;
  subtasks: Task[];
  projects: Project[];
  labels: Label[];
  selection: Selection;
  today: string;
  selectedTaskId: string | null;
  onSelect: (id: string) => void;
  onToggle: (task: Task) => void;
}

export function TaskRow({
  task,
  subtasks,
  projects,
  labels,
  selection,
  today,
  selectedTaskId,
  onSelect,
  onToggle,
}: Props) {
  const project = projects.find((p) => p.id === task.projectId) ?? null;
  const done = task.completedAt !== null;

  const classes = ['task-row'];
  if (task.id === selectedTaskId) classes.push('task-row--selected');
  if (done) classes.push('task-row--done');

  // Meta shown only where it adds something: the project everywhere except
  // inside that project's own list, the date everywhere except under a heading
  // that already says it.
  const showProject = project !== null && selection.kind !== 'project';
  const showDate =
    task.dueDate !== null && selection.kind !== 'upcoming' && !(selection.kind === 'today' && !done);

  /*
   * Labels a task actually carries, in the label list's own order so two rows
   * never show the same pair the other way round. The one you're already
   * inside is left off — it would be on every row and say nothing.
   */
  const worn = labels.filter(
    (l) => (task.labelIds ?? []).includes(l.id) && l.id !== (selection.kind === 'label' ? selection.labelId : null),
  );

  return (
    <li className={classes.join(' ')}>
      <div className="task-row__main">
        <button
          type="button"
          className="task-check"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={() => onToggle(task)}
        />
        <button
          type="button"
          className="task-row__body brackets"
          onClick={() => onSelect(task.id)}
        >
          {/* Subtasks belong to their parent's reference; giving them their
              own would imply they're filed separately, which they aren't. */}
          {task.parentId === null && (
            <span className="task-ref">{taskRef(task, projects)}</span>
          )}
          <span className="task-title">{task.title}</span>
          <span className="task-meta">
            {task.priority !== null && (
              <span className="priority-flag" data-priority={task.priority}>
                P{task.priority}
              </span>
            )}
            {showProject && (
              <span className="meta-project">
                <span className="project-dot" data-color={project.colorId} aria-hidden="true" />
                {project.name}
              </span>
            )}
            {worn.map((label) => (
              <span key={label.id} className="meta-label" data-color={label.colorId}>
                {label.name}
              </span>
            ))}
            {showDate && <span className="meta-due">{dateLabel(task.dueDate!, today)}</span>}
            {task.recurrence !== null && (
              <span className="meta-recurrence">↻ {describeRecurrence(task.recurrence)}</span>
            )}
            {task.notes !== null && task.notes !== '' && (
              <span className="meta-notes" aria-label="Has notes">
                ≡
              </span>
            )}
          </span>
        </button>
      </div>

      {subtasks.length > 0 && (
        <ul className="subtask-list">
          {subtasks.map((sub) => (
            <TaskRow
              key={sub.id}
              task={sub}
              subtasks={[]}
              projects={projects}
              labels={labels}
              selection={selection}
              today={today}
              selectedTaskId={selectedTaskId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
