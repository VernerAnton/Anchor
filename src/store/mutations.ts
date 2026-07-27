import type { Path, Point } from '../types/path';

/**
 * Every change to a stored day, as pure functions.
 *
 * Funnelling writes through one module is what keeps the eventual Firestore
 * work small: the app calls `savePath(clearPoint(path, id, now))`, and the only
 * thing that has to learn about the network is `savePath`. It also means a
 * mutation can be reasoned about — and tested — without a store at all.
 */

/** Stamps the write clock. Every mutation ends here. */
function touch(path: Path): Path {
  return { ...path, updatedAt: Date.now() };
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
