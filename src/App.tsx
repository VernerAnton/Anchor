import { useEffect, useMemo, useState } from 'react';
import type { Path } from './types/path';
import { buildRoute } from './lib/route';
import { ALL_TIME, buildLedger } from './lib/ledger';
import { dayRecordFor } from './lib/dayRecord';
import { toDateKey } from './lib/time';
import { useNow } from './hooks/useNow';
import { useDays, usePath, useSettings } from './hooks/useStore';
import { repository } from './store';
import { bootstrap } from './store/bootstrap';
import { clearPoint, retimePoint, startPoint } from './store/mutations';
import { seedCarriedTotal, seedRouteNumber } from './data/seed';
import { Atmosphere } from './components/Atmosphere';
import { Header } from './components/Header';
import { ModeToggle } from './components/ModeToggle';
import { RouteStatus } from './components/RouteStatus';
import { PathView } from './components/PathView';
import { Ledger } from './components/Ledger';

export function App() {
  const { now, date } = useNow();
  const today = toDateKey(date);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    bootstrap(repository, today).then(() => setReady(true));
  }, [today]);

  const { settings } = useSettings();
  const { path, loading } = usePath(today);
  // All of history, because the running total spans it. Daily records are tiny
  // and there is one per day; if this ever needs bounding, a rolled-up total
  // document replaces the sum rather than the window shrinking.
  const { days } = useDays(ALL_TIME, today);

  /**
   * Which point is holding an open offer. Deliberately session state and never
   * stored: an offer is where you are standing right now, not a fact about the
   * day. Persisting it would mean it reappearing on every reload after you'd
   * already declined, and syncing it would mean clearing a point on your phone
   * popping a prompt on your laptop.
   */
  const [offerFor, setOfferFor] = useState<string | null>(null);

  const route = useMemo(
    () =>
      path
        ? buildRoute(path, { now, offerFor, markerMode: settings.markerMode })
        : null,
    [path, now, offerFor, settings.markerMode],
  );
  const ledger = useMemo(() => buildLedger(days, today, seedCarriedTotal), [days, today]);

  /** Mutate, then write. The one place that will learn about the network. */
  const commit = (next: Path) => void repository.savePath(next);

  /**
   * Writes the path and the ledger row it implies, so the running total moves
   * the moment something is cleared rather than at the end of the day.
   */
  const commitCleared = (next: Path) => {
    commit(next);
    void repository.saveDay(dayRecordFor(next));
  };

  const start = (id: string) => path && commit(startPoint(path, id, now));

  const clear = (id: string) => {
    if (!path) return;
    commitCleared(clearPoint(path, id, now));
    // Clearing a point is the only thing that ever raises the offer, and only
    // when there's something left to offer.
    setOfferFor(route?.upNext ? id : null);
  };

  /**
   * Riding it means doing the next thing now, so the next point's start time
   * moves to now rather than the path holding you to a time you've already
   * beaten.
   */
  const acceptOffer = () => {
    const next = route?.upNext;
    setOfferFor(null);
    if (path && next) commit(retimePoint(path, next.point.id, now));
  };

  /** Costs nothing, records nothing, changes nothing about the day. */
  const declineOffer = () => setOfferFor(null);

  const toggleMarker = () =>
    void repository.saveSettings({
      ...settings,
      markerMode: settings.markerMode === 'live' ? 'fixed' : 'live',
      updatedAt: Date.now(),
    });

  return (
    <>
      <Atmosphere />
      <main className="shell">
        <Header date={date} now={now} routeNumber={seedRouteNumber} />
        <ModeToggle />
        {path && route && (
          <>
            <RouteStatus
              cleared={route.cleared}
              lockedAt={path.lockedAt}
              markerMode={settings.markerMode}
              onToggleMarker={toggleMarker}
            />
            <PathView
              route={route}
              endsAt={path.endsAt}
              offerFor={offerFor}
              onStart={start}
              onClear={clear}
              onAcceptOffer={acceptOffer}
              onDeclineOffer={declineOffer}
            />
          </>
        )}
        {ready && !loading && !path && <NoRoute />}
        <Ledger view={ledger} />
      </main>
    </>
  );
}

/**
 * A placeholder until A3 designs this properly. The empty state is the hardest
 * screen in this product — an empty canvas is the worst thing to hand someone
 * who opened the app precisely because starting is hard — so this says only
 * that nothing is set, and claims nothing more.
 */
function NoRoute() {
  return (
    <p className="meta" style={{ marginTop: 8 }}>
      NO ROUTE SET FOR TODAY
    </p>
  );
}
