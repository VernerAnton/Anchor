import type { CSSProperties, ReactNode } from 'react';
import type { PointView } from '../lib/route';
import { durationMinutes } from '../lib/route';
import type { Project } from '../types/task';
import { toClock } from '../lib/time';
import { ProjectMark } from './build/ProjectMark';

interface Props {
  view: PointView;
  /** 1-based position among points only — rest doesn't take a node number. */
  ordinal: number;
  project: Project | undefined;
  onStart: (id: string) => void;
  onClear: (id: string) => void;
  onLog: (id: string) => void;
  onUnlog: (id: string) => void;
  children?: ReactNode;
}

export function PointNode({
  view,
  ordinal,
  project,
  onStart,
  onClear,
  onLog,
  onUnlog,
  children,
}: Props) {
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
            {project && (
              <>
                {' · '}
                <ProjectMark project={project} />
              </>
            )}
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

        {/*
          Logging, as distinct from doing. A point done early, done late, or
          done after the clock moved past it is still done, and the ledger is a
          record of what happened rather than of compliance.

          Deliberately quiet: no ember, because nothing should glow at you about
          a point that isn't the one pulling you now.
        */}
        {status !== 'live' && !cleared && (
          <button type="button" className="log" onClick={() => onLog(point.id)}>
            Log it
          </button>
        )}
        {/*
          Undo stays small and off to the side. A completed point should read as
          settled — giving every one of them a full-width control would make the
          proof section look like a row of things still asking to be dealt with.
        */}
        {cleared && status !== 'live' && (
          <button type="button" className="undo" onClick={() => onUnlog(point.id)}>
            {toClock(point.completedAt!)} · undo
          </button>
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
