import type { Path, Point, Rest, Segment } from '../types/path';
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
  const point: Point = { kind: 'point', id: newId(), ...draft, startedAt: null, completedAt: null };
  return touch({ ...path, segments: [...path.segments, point] });
}

export function updatePoint(path: Path, id: string, draft: PointDraft): Path {
  return mapPoint(path, id, (point) => ({ ...point, ...draft }));
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
