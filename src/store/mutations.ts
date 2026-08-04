import type { Path, Point, Rest, Segment } from '../types/path';
import type { Priority, Project, ProjectColor, Task } from '../types/task';
import { PROJECT_COLOR_IDS } from '../types/task';
import { newId } from '../lib/id';
import { SCHEMA_VERSION } from './keys';

/**
 * Every change to a stored day, as pure functions.
 *
 * Funnelling writes through one module is what keeps the eventual Firestore
 * work small: the app calls `savePath(clearPoint(path, id, now))`, and the only
 * thing that has to learn about the network is `savePath`. It also means a
 * mutation can be reasoned about — and tested — without a store at all.
 */

/**
 * Stamps the write. Every mutation ends here.
 *
 * The version bump is synchronous and happens before anything async — the
 * discipline the working sync layer proved out. By the time a write is in
 * flight, local state already carries the higher version, so a stale echo of
 * the previous write can never overwrite what you just did.
 */
function touch(path: Path): Path {
  return { ...path, version: (path.version ?? 0) + 1, updatedAt: Date.now() };
}

/**
 * Keeps the end of the route past the last thing on it. A point scheduled
 * beyond the old end would otherwise sit on top of the "path stops here"
 * marker, which would be claiming the day ended before its last task.
 */
function extendEnd(path: Path): Path {
  const latest = path.segments.reduce((end, segment) => {
    if (segment.kind !== 'point') return end;
    const mins =
      segment.duration.kind === 'fixed'
        ? segment.duration.minutes
        : segment.duration.estimateMinutes;
    return Math.max(end, segment.startsAt + mins);
  }, 0);
  const endsAt = Math.min(24 * 60, Math.max(path.endsAt, latest + 15));
  return endsAt === path.endsAt ? path : { ...path, endsAt };
}

function mapPoint(path: Path, id: string, fn: (point: Point) => Point): Path {
  return touch({
    ...path,
    segments: path.segments.map((segment) =>
      segment.kind === 'point' && segment.id === id ? fn(segment) : segment,
    ),
  });
}

/** The first move was made. Records when, which `startsAt` cannot tell you. */
export function startPoint(path: Path, id: string, now: number): Path {
  return mapPoint(path, id, (point) => ({ ...point, startedAt: now }));
}

/**
 * It happened. `startedAt` is backfilled for a point cleared without ever being
 * formally started, because "it happened" is the bar, not "it was done the
 * prescribed way".
 */
export function clearPoint(path: Path, id: string, now: number): Path {
  return mapPoint(path, id, (point) => ({
    ...point,
    startedAt: point.startedAt ?? now,
    completedAt: now,
  }));
}

/**
 * Riding the momentum moves the next point to now, rather than holding you to a
 * time you've already beaten.
 */
export function retimePoint(path: Path, id: string, startsAt: number): Path {
  return mapPoint(path, id, (point) => ({ ...point, startsAt }));
}

// ── Building the path ──────────────────────────────────────────────────────

/** The shape the editor collects. Never includes progress — that isn't edited. */
export type PointDraft = Pick<
  Point,
  'title' | 'firstMove' | 'startsAt' | 'duration' | 'type' | 'label'
>;

export function emptyPath(date: string): Path {
  return {
    id: `path-${date}`,
    date,
    lockedAt: null,
    endsAt: 9 * 60 + 30,
    segments: [],
    schemaVersion: SCHEMA_VERSION,
    version: 0,
    updatedAt: Date.now(),
  };
}

export function addPoint(path: Path, draft: PointDraft): Path {
  const point: Point = {
    kind: 'point',
    id: newId(),
    taskId: null,
    projectId: null,
    ...draft,
    startedAt: null,
    completedAt: null,
  };
  return touch(extendEnd({ ...path, segments: [...path.segments, point] }));
}

/**
 * Schedules a library task onto a day.
 *
 * The task's display fields are *copied*, not referenced. That's what freezes
 * history: the day records what it said on the day, and renaming the task
 * later changes the library and every future scheduling of it while reaching
 * nothing already walked. `taskId` keeps the provenance so the two can still
 * be related when that's useful.
 */
export function addPointFromTask(path: Path, task: Task, startsAt: number): Path {
  const point: Point = {
    kind: 'point',
    id: newId(),
    taskId: task.id,
    projectId: task.projectId,
    title: task.title,
    firstMove: task.firstMove,
    startsAt,
    duration: task.defaultDuration,
    type: task.type,
    label: null,
    startedAt: null,
    completedAt: null,
  };
  return touch(extendEnd({ ...path, segments: [...path.segments, point] }));
}

/**
 * Records that a point happened, whatever the clock says about it.
 *
 * Separate from `clearPoint` because this is logging rather than doing: a point
 * done early, done late, or done while the path thought it had gone by is still
 * done. Refusing to record it would make the ledger a record of compliance
 * instead of a record of what happened.
 */
export function logPoint(path: Path, id: string, at: number): Path {
  return mapPoint(path, id, (point) => ({
    ...point,
    startedAt: point.startedAt ?? at,
    completedAt: at,
  }));
}

/** Undoes a log. Mis-taps happen, and a wrong record is worse than none. */
export function unlogPoint(path: Path, id: string): Path {
  return mapPoint(path, id, (point) => ({ ...point, startedAt: null, completedAt: null }));
}

export function updatePoint(path: Path, id: string, draft: PointDraft): Path {
  return extendEnd(mapPoint(path, id, (point) => ({ ...point, ...draft })));
}

export function addRest(path: Path, minutes: number, label: string | null): Path {
  const rest: Rest = { kind: 'rest', id: newId(), minutes, label };
  return touch({ ...path, segments: [...path.segments, rest] });
}

export function updateRest(path: Path, id: string, minutes: number, label: string | null): Path {
  return touch({
    ...path,
    segments: path.segments.map((segment) =>
      segment.kind === 'rest' && segment.id === id ? { ...segment, minutes, label } : segment,
    ),
  });
}

export function removeSegment(path: Path, id: string): Path {
  return touch({ ...path, segments: path.segments.filter((segment) => segment.id !== id) });
}

/**
 * Array order is the path's order, so moving a segment is a swap.
 *
 * Order is not re-derived from start times, and points are never silently
 * re-sorted. Rest belongs *between* two particular things, which a sort by time
 * cannot express — and a path rearranging itself under you is exactly the kind
 * of surprise this app should never spring.
 */
export function moveSegment(path: Path, id: string, direction: -1 | 1): Path {
  const from = path.segments.findIndex((segment) => segment.id === id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= path.segments.length) return path;

  const segments: Segment[] = [...path.segments];
  const moved = segments[from]!;
  segments[from] = segments[to]!;
  segments[to] = moved;
  return touch({ ...path, segments });
}

/**
 * Locking is a promise to your morning self, not a restriction. Editing a
 * locked path stays possible — the lock removes the *invitation* to re-decide,
 * and a path you couldn't fix on a bad morning would be a trap rather than a
 * support.
 */
export function setLocked(path: Path, lockedAt: number | null): Path {
  return touch({ ...path, lockedAt });
}

// ── The library ────────────────────────────────────────────────────────────

export type TaskDraft = Pick<
  Task,
  'title' | 'firstMove' | 'type' | 'defaultDuration' | 'projectId' | 'priority'
>;

export function newTask(draft: TaskDraft): Task {
  return {
    id: newId(),
    ...draft,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}

export function editTask(task: Task, draft: TaskDraft): Task {
  return { ...task, ...draft, version: task.version + 1, updatedAt: Date.now() };
}

/**
 * Archiving rather than deleting is the default for anything a past day might
 * point at — the record should still be able to say where its work came from.
 */
export function archiveTask(task: Task, archived: boolean): Task {
  return { ...task, archived, version: task.version + 1, updatedAt: Date.now() };
}

export function newProject(name: string, order: number, colorId?: ProjectColor): Project {
  return {
    id: newId(),
    name,
    colorId: colorId ?? PROJECT_COLOR_IDS[order % PROJECT_COLOR_IDS.length]!,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}

export function editProject(
  project: Project,
  changes: Partial<Pick<Project, 'name' | 'colorId' | 'order' | 'archived'>>,
): Project {
  return { ...project, ...changes, version: project.version + 1, updatedAt: Date.now() };
}

export function setTaskPriority(task: Task, priority: Priority | null): Task {
  return { ...task, priority, version: task.version + 1, updatedAt: Date.now() };
}
