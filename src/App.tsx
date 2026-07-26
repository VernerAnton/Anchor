import { useMemo, useState } from 'react';
import type { Path, Point } from './types/path';
import { buildRoute } from './lib/route';
import { buildLedger } from './lib/ledger';
import { useNow } from './hooks/useNow';
import {
  seedCarriedTotal,
  seedLedger,
  seedOfferFor,
  seedPath,
  seedRouteNumber,
} from './data/seed';
import { Atmosphere } from './components/Atmosphere';
import { Header } from './components/Header';
import { ModeToggle } from './components/ModeToggle';
import { RouteStatus } from './components/RouteStatus';
import { PathView } from './components/PathView';
import { Ledger } from './components/Ledger';

export function App() {
  const { now, date } = useNow();
  const [path, setPath] = useState<Path>(seedPath);
  const [offerFor, setOfferFor] = useState<string | null>(seedOfferFor);

  const route = useMemo(() => buildRoute(path, { now, offerFor }), [path, now, offerFor]);
  const ledger = useMemo(() => buildLedger(seedLedger, seedCarriedTotal), []);

  const updatePoint = (id: string, patch: Partial<Point>) =>
    setPath((prev) => ({
      ...prev,
      segments: prev.segments.map((s) =>
        s.kind === 'point' && s.id === id ? { ...s, ...patch } : s,
      ),
    }));

  const start = (id: string) => updatePoint(id, { startedAt: now });

  const clear = (id: string) => {
    setPath((prev) => ({
      ...prev,
      segments: prev.segments.map((s) =>
        s.kind === 'point' && s.id === id
          ? { ...s, startedAt: s.startedAt ?? now, completedAt: now }
          : s,
      ),
    }));
    // Clearing a point is the only thing that ever raises the offer, and only
    // when there's something left to offer.
    setOfferFor(route.upNext ? id : null);
  };

  /**
   * Riding it means doing the next thing now, so the next point's start time
   * moves to now rather than the path holding you to a time you've already
   * beaten.
   */
  const acceptOffer = () => {
    const next = route.upNext;
    setOfferFor(null);
    if (next) updatePoint(next.point.id, { startsAt: now });
  };

  /** Costs nothing, records nothing, changes nothing about the day. */
  const declineOffer = () => setOfferFor(null);

  const toggleMarker = () =>
    setPath((prev) => ({
      ...prev,
      markerMode: prev.markerMode === 'live' ? 'fixed' : 'live',
    }));

  return (
    <>
      <Atmosphere />
      <main className="shell">
        <Header date={date} now={now} routeNumber={seedRouteNumber} />
        <ModeToggle />
        <RouteStatus
          cleared={route.cleared}
          lockedAt={path.lockedAt}
          markerMode={path.markerMode}
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
        <Ledger view={ledger} />
      </main>
    </>
  );
}
