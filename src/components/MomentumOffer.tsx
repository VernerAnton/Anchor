import type { PointView } from '../lib/route';
import { durationMinutes } from '../lib/route';

interface Props {
  next: PointView;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * The offer, and the reason it's cyan: cyan means you may decline this.
 *
 * Finishing one thing sometimes leaves enough lift to start the next one
 * easily. When it does, this is worth having. When it doesn't, declining has
 * to cost exactly nothing — no penalty, no reproach, no visual demotion of
 * the day. "Not now" sits beside "Ride it" as an equal, and nothing anywhere
 * in the app records that it was chosen.
 */
export function MomentumOffer({ next, onAccept, onDecline }: Props) {
  return (
    <div className="offer">
      <div className="lead">Momentum · Optional</div>
      <div className="q">
        You&rsquo;re already moving.
        <br />
        <u>Keep going?</u>
      </div>
      <div className="fine">NEXT: {describe(next)}</div>
      <div className="row">
        <button type="button" className="yes" onClick={onAccept}>
          Ride it
        </button>
        <button type="button" className="no" onClick={onDecline}>
          Not now
        </button>
      </div>
    </div>
  );
}

function describe(view: PointView): string {
  const title = view.point.title.toUpperCase().replace(/\s*—\s*/g, ' · ');
  const mins = durationMinutes(view.point.duration);
  const stop = view.point.duration.kind === 'fixed' ? 'HARD STOP' : 'ENDS ON ITS OWN';
  return `${title} · ${mins} MIN, ${stop}`;
}
