import { useState } from 'react';
import type { Path, Point, Rest } from '../../types/path';
import type { Project, Task } from '../../types/task';
import { repository } from '../../store';
import type { PointDraft } from '../../store/mutations';
import {
  addPoint,
  addPointFromTask,
  addRest,
  emptyPath,
  moveSegment,
  removeSegment,
  setLocked,
  updatePoint,
  updateRest,
} from '../../store/mutations';
import { dayRecordFor } from '../../lib/dayRecord';
import { usePath } from '../../hooks/useStore';
import { shiftDate, toClock, toDateKey } from '../../lib/time';
import { PointEditor } from '../PointEditor';
import { RestEditor } from '../RestEditor';
import { SegmentTools } from '../SegmentTools';
import { ProjectMark } from './ProjectMark';

type Panel =
  | { kind: 'none' }
  | { kind: 'point'; id: string | null }
  | { kind: 'rest'; id: string | null }
  | { kind: 'pick' };

interface Props {
  tasks: Task[];
  projects: Project[];
}

/**
 * Where a day is actually assembled.
 *
 * This is the half of the workshop that the route view gave up. Building
 * happens here, deliberately at a different time from walking — which is the
 * mechanism, not an inconvenience. Tomorrow is the default day, because the
 * point of the whole thing is to have decided before the morning arrives.
 */
export function RouteBuilder({ tasks, projects }: Props) {
  const today = toDateKey();
  const [date, setDate] = useState(shiftDate(today, 1));
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const { path } = usePath(date);

  const commit = (next: Path) => {
    void repository.savePath(next);
    void repository.saveDay(dayRecordFor(next));
    setPanel({ kind: 'none' });
  };
  const base = () => path ?? emptyPath(date);

  const nextStart = () => {
    const points = (path?.segments ?? []).filter((s): s is Point => s.kind === 'point');
    const last = points.at(-1);
    return Math.min(23 * 60 + 30, Math.ceil((last ? last.startsAt + 30 : 8 * 60) / 30) * 30);
  };

  const editingPoint =
    panel.kind === 'point' && panel.id
      ? (path?.segments.find((s) => s.id === panel.id) as Point | undefined)
      : undefined;
  const editingRest =
    panel.kind === 'rest' && panel.id
      ? (path?.segments.find((s) => s.id === panel.id) as Rest | undefined)
      : undefined;

  const savePoint = (draft: PointDraft) =>
    commit(panel.kind === 'point' && panel.id
      ? updatePoint(base(), panel.id, draft)
      : addPoint(base(), draft));

  const saveRest = (minutes: number, label: string | null) =>
    commit(panel.kind === 'rest' && panel.id
      ? updateRest(base(), panel.id, minutes, label)
      : addRest(base(), minutes, label));

  const projectOf = (id: string | null) => projects.find((p) => p.id === id);
  const live = tasks.filter((task) => !task.archived);

  return (
    <div className="builder">
      <div className="daynav">
        <button type="button" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
          ◄
        </button>
        <span className="daynav-label">{describe(date, today)}</span>
        <button type="button" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">
          ►
        </button>
      </div>

      <div className="build-actions">
        <button type="button" onClick={() => setPanel({ kind: 'pick' })}>
          + From library
        </button>
        <button type="button" onClick={() => setPanel({ kind: 'point', id: null })}>
          + One-off
        </button>
        <button type="button" onClick={() => setPanel({ kind: 'rest', id: null })}>
          + Rest
        </button>
        <button
          type="button"
          className="right"
          onClick={() => commit(setLocked(base(), path?.lockedAt === null ? 23 * 60 : null))}
        >
          {path?.lockedAt == null ? 'Lock it' : `Locked ${toClock(path.lockedAt)}`}
        </button>
      </div>

      {panel.kind === 'pick' && (
        <div className="picker">
          <div className="editor-hd">Put on {describe(date, today).toLowerCase()}</div>
          {live.length === 0 && <p className="tempty">No tasks in the library yet.</p>}
          {live.map((task) => (
            <button
              key={task.id}
              type="button"
              className="pick"
              onClick={() => commit(addPointFromTask(base(), task, nextStart()))}
            >
              <span>{task.title}</span>
              <ProjectMark project={projectOf(task.projectId)} />
            </button>
          ))}
          <button type="button" className="cancel wide" onClick={() => setPanel({ kind: 'none' })}>
            Cancel
          </button>
        </div>
      )}

      {panel.kind === 'point' && (
        <PointEditor
          point={editingPoint ?? null}
          defaultStartsAt={nextStart()}
          onSave={savePoint}
          onCancel={() => setPanel({ kind: 'none' })}
        />
      )}
      {panel.kind === 'rest' && (
        <RestEditor
          rest={editingRest ?? null}
          onSave={saveRest}
          onCancel={() => setPanel({ kind: 'none' })}
        />
      )}

      <ul className="seglist">
        {(path?.segments ?? []).map((segment) => (
          <li key={segment.id} className="segrow">
            {segment.kind === 'point' ? (
              <>
                <div className="segrow-main">
                  <span className="segrow-time">{toClock(segment.startsAt)}</span>
                  <span className="trow-title">{segment.title}</span>
                  <span className="trow-sub">
                    {segment.firstMove} · {segment.type}
                  </span>
                </div>
                <ProjectMark project={projectOf(segment.projectId)} />
              </>
            ) : (
              // Editable, never completable. The editor sets how long it runs
              // and what it's for; there is no control here that finishes it.
              <div className="segrow-main rest">
                <span className="trow-sub">
                  REST{segment.label ? ` · ${segment.label}` : ''} · {segment.minutes} MIN
                </span>
              </div>
            )}
            <SegmentTools
              onEdit={() =>
                setPanel({ kind: segment.kind === 'rest' ? 'rest' : 'point', id: segment.id })
              }
              onMoveUp={() => commit(moveSegment(base(), segment.id, -1))}
              onMoveDown={() => commit(moveSegment(base(), segment.id, 1))}
              onRemove={() => commit(removeSegment(base(), segment.id))}
            />
          </li>
        ))}
        {(path?.segments.length ?? 0) === 0 && (
          <li className="tempty">Nothing on this day yet.</li>
        )}
      </ul>
    </div>
  );
}

function describe(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === shiftDate(today, 1)) return 'Tomorrow';
  if (date === shiftDate(today, -1)) return 'Yesterday';
  const [, month, day] = date.split('-').map(Number);
  return `${day}/${month}`;
}
