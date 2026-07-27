import type { MarkerMode } from '../types/path';
import { toClock } from '../lib/time';

const WORDS = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five',
  'Six', 'Seven', 'Eight', 'Nine', 'Ten',
] as const;

interface Props {
  cleared: number;
  total: number;
  /** A day still ahead reports what's set, not what's done. */
  future: boolean;
  lockedAt: number | null;
  markerMode: MarkerMode;
  onToggleMarker: () => void;
  onToggleLock: () => void;
}

export function RouteStatus({
  cleared,
  total,
  future,
  lockedAt,
  markerMode,
  onToggleMarker,
  onToggleLock,
}: Props) {
  const count = future ? total : cleared;
  const word = WORDS[count] ?? String(count);
  const noun = count === 1 ? 'point' : 'points';

  return (
    <>
      <h1 className="status">
        {word} {noun}
        <br />
        <i>{future ? 'waiting.' : 'behind you.'}</i>
      </h1>
      <p className="meta">
        {/*
          Locking is the highest-leverage thing in the app, so it's a control
          rather than a readout — and it stays reversible, because a plan you
          can't amend on a bad morning is a trap rather than a support.
        */}
        <button
          type="button"
          className="lock"
          onClick={onToggleLock}
          title={
            lockedAt === null
              ? 'Lock it, so the morning has nothing left to decide.'
              : 'Locked. You can still change it — the lock just stops it asking.'
          }
        >
          {lockedAt === null
            ? 'ROUTE OPEN · NOT LOCKED YET'
            : `ROUTE LOCKED ${toClock(lockedAt)} · NOTHING LEFT TO DECIDE`}
        </button>{' '}
        ·{' '}
        <button
          type="button"
          onClick={onToggleMarker}
          title={
            markerMode === 'live'
              ? 'The marker moves with the clock. Tap to hold it still instead.'
              : 'The marker holds where you left it. Tap to let it follow the clock.'
          }
        >
          MARKER {markerMode === 'live' ? 'LIVE' : 'HELD'}
        </button>
      </p>
    </>
  );
}
