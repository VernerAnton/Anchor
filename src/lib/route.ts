import type { Duration, Path, Point, PointStatus, Segment } from '../types/path';

export function durationMinutes(d: Duration): number {
  return d.kind === 'fixed' ? d.minutes : d.estimateMinutes;
}

export interface PointView {
  kind: 'point';
  point: Point;
  index: number;
  status: PointStatus;
  /** Minutes from midnight the point's window closes. */
  endsAt: number;
  /** 0..1, drives the rail under the title. */
  progress: number;
}

export interface RestView {
  kind: 'rest';
  index: number;
  rest: Extract<Segment, { kind: 'rest' }>;
  /** Rest you haven't reached yet renders cold rather than lit. */
  ahead: boolean;
}

export type SegmentView = PointView | RestView;

export interface RouteView {
  segments: SegmentView[];
  /** The point you are standing at, if any. */
  live: PointView | null;
  /** What the momentum offer would propose next, if anything. */
  upNext: PointView | null;
  cleared: number;
  total: number;
}

interface Options {
  /** Minutes from midnight. */
  now: number;
  /**
   * The point currently holding an open momentum offer. That point keeps
   * rendering as live even once it's cleared — the offer is what's holding
   * your position on the path, and it settles only when you answer it.
   */
  offerFor?: string | null;
}

/**
 * Derives every renderable state from the stored path plus where you are.
 *
 * Note what is *not* stored anywhere: `passed`. A point becomes passed purely
 * by the clock moving past it, and only in `live` marker mode. In `fixed`
 * mode nothing is ever overtaken — the first unlogged point stays live for as
 * long as it takes, which is the entire difference between the two modes.
 */
export function buildRoute(path: Path, { now, offerFor = null }: Options): RouteView {
  const points = path.segments.filter((s): s is Point => s.kind === 'point');
  const firstUnlogged = points.find((p) => p.completedAt === null);

  const statusOf = (p: Point): PointStatus => {
    if (offerFor === p.id) return 'live';
    if (p.completedAt !== null) return 'done';

    if (path.markerMode === 'fixed') {
      return p.id === firstUnlogged?.id ? 'live' : 'next';
    }
    const ends = p.startsAt + durationMinutes(p.duration);
    if (now >= ends) return 'passed';
    if (now >= p.startsAt) return 'live';
    return 'next';
  };

  const segments: SegmentView[] = path.segments.map((segment, index) => {
    if (segment.kind === 'rest') {
      return { kind: 'rest', index, rest: segment, ahead: false };
    }
    const status = statusOf(segment);
    const endsAt = segment.startsAt + durationMinutes(segment.duration);
    // Progress runs from when you actually began, not from when the path
    // said you would — starting late doesn't cost you part of the bar.
    const from = segment.startedAt ?? segment.startsAt;
    const elapsed = (now - from) / durationMinutes(segment.duration);
    // A cleared point reads full whatever else is true of it — including
    // while it's still the live node holding an open offer.
    const progress =
      segment.completedAt !== null ? 1 : status === 'live' ? clamp(elapsed, 0, 1) : 0;
    return { kind: 'point', point: segment, index, status, endsAt, progress };
  });

  const live = segments.find((s): s is PointView => s.kind === 'point' && s.status === 'live') ?? null;

  // Rest ahead of where you're standing renders cold. Rest you've already
  // passed through stays lit — it happened, and it counted.
  const frontier = live
    ? live.index
    : lastIndexWhere(segments, (s) => s.kind === 'point' && s.status !== 'next');
  for (const s of segments) {
    if (s.kind === 'rest') s.ahead = s.index > frontier;
  }

  const upNext =
    live === null
      ? null
      : (segments.find(
          (s): s is PointView =>
            s.kind === 'point' && s.index > live.index && s.status === 'next',
        ) ?? null);

  return {
    segments,
    live,
    upNext,
    cleared: points.filter((p) => p.completedAt !== null).length,
    total: points.length,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function lastIndexWhere<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && predicate(item)) return i;
  }
  return -1;
}
