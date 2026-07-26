import type { CSSProperties, ReactNode } from 'react';
import type { PointView } from '../lib/route';
import { durationMinutes } from '../lib/route';
import { toClock } from '../lib/time';

interface Props {
  view: PointView;
  /** 1-based position among points only — rest doesn't take a node number. */
  ordinal: number;
  onStart: (id: string) => void;
  onClear: (id: string) => void;
  children?: ReactNode;
}

export function PointNode({ view, ordinal, onStart, onClear, children }: Props) {
  const { point, status, progress } = view;
  const style = { '--p': `${Math.round(progress * 100)}%` } as CSSProperties;
  const cleared = point.completedAt !== null;
  const underway = point.startedAt !== null && !cleared;

  return (
    <li className={`n ${status}`}>
      <span className="t">
        {toClock(point.startsAt)}
        {status === 'live' && (
          <>
            <br />
            NOW
          </>
        )}
      </span>
      <span className="pip" aria-hidden="true" />

      <div className="card">
        <div className="tag">
          <span>
            NODE {String(ordinal).padStart(2, '0')} ·{' '}
            {(point.label ?? point.type).toUpperCase()}
          </span>
          {status === 'live' ? (
            <span className="flag">
              {cleared ? `CLEARED ${toClock(point.completedAt!)}` : 'LIVE'}
            </span>
          ) : (
            <b>{RIGHT_TAG[status]}</b>
          )}
        </div>

        <div className="act">{point.title}</div>

        <div className="dur">
          {durationLine(view)} <span className="rail" style={style} />
        </div>

        {/*
          The button never says "start" and never restates the task. It says
          the smallest move that begins it, because that's the version of the
          ask that's small enough to be trivial to say yes to.
        */}
        {status === 'live' && !cleared && (
          underway ? (
            <button type="button" className="go" onClick={() => onClear(point.id)}>
              Mark it cleared ►
            </button>
          ) : (
            <button type="button" className="go" onClick={() => onStart(point.id)}>
              {point.firstMove} ►
            </button>
          )
        )}
      </div>

      {children}
    </li>
  );
}

const RIGHT_TAG = {
  done: 'CLEARED',
  // Not "missed", not "skipped". It went by; you're still on the route.
  passed: 'PASSED',
  next: 'QUEUED',
  live: 'LIVE',
} as const;

function durationLine(view: PointView): string {
  if (view.status === 'passed') return 'NOT LOGGED · STILL ON THE ROUTE';

  const mins = durationMinutes(view.point.duration);
  if (view.point.duration.kind === 'natural') {
    return `${mins} MIN · SELF-TERMINATING`;
  }
  // The hard stop is a promise about how far this goes. Once it's behind you
  // it has nothing left to promise, so it stops being worth the ink.
  const ahead = view.status === 'live' || view.status === 'next';
  return ahead ? `${mins} MIN · HARD STOP` : `${mins} MIN`;
}
