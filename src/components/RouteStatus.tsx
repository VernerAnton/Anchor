import type { MarkerMode } from '../types/path';
import { toClock } from '../lib/time';

const WORDS = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five',
  'Six', 'Seven', 'Eight', 'Nine', 'Ten',
] as const;

interface Props {
  cleared: number;
  lockedAt: number | null;
  markerMode: MarkerMode;
  onToggleMarker: () => void;
}

export function RouteStatus({ cleared, lockedAt, markerMode, onToggleMarker }: Props) {
  const word = WORDS[cleared] ?? String(cleared);
  const noun = cleared === 1 ? 'point' : 'points';

  return (
    <>
      <h1 className="status">
        {word} {noun}
        <br />
        <i>behind you.</i>
      </h1>
      <p className="meta">
        {lockedAt === null ? (
          <>ROUTE OPEN · STILL YOURS TO SET</>
        ) : (
          <>ROUTE LOCKED {toClock(lockedAt)} PREV · NOTHING LEFT TO DECIDE</>
        )}{' '}
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
