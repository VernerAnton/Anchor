import type { LedgerView } from '../lib/ledger';

/**
 * Two numbers and fourteen marks, and not one of them can be broken.
 *
 * The left number only ever climbs. The right one is a rolling window, so a
 * quiet day drops out of it on its own within a fortnight rather than being
 * held against you. There is deliberately no consecutive-day count anywhere
 * on this panel — that's the number that turns one missed day into a reason
 * to stop entirely.
 */
export function Ledger({ view }: { view: LedgerView }) {
  return (
    <section className="ledger">
      <div className="hd">
        <span>Momentum</span>
        <span>No chains</span>
      </div>

      <div className="nums">
        <div className="num">
          <div className="v">{view.total}</div>
          <div className="k">points cleared</div>
        </div>
        <div className="num">
          <div className="v">
            {view.hits}
            <small>/{view.windowDays}</small>
          </div>
          <div className="k">last two weeks</div>
        </div>
      </div>

      <div className="dots" aria-hidden="true">
        {view.marks.map((mark, i) => (
          <i key={i} className={mark} />
        ))}
      </div>

      <p className="foot">
        Gaps are part of the route · <b>Nothing resets</b>
        <br />
        Show up in the next quiet hour
      </p>
    </section>
  );
}
