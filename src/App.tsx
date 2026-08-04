import { useEffect, useMemo, useState } from 'react';
import type { Path } from './types/path';
import { buildRoute } from './lib/route';
import { ALL_TIME, buildLedger } from './lib/ledger';
import { dayRecordFor } from './lib/dayRecord';
import { newId } from './lib/id';
import { runRollover } from './lib/rollover';
import { shiftDate, toDateKey } from './lib/time';
import { useNow } from './hooks/useNow';
import { useDays, usePath, useProjects, useSettings } from './hooks/useStore';
import { repository } from './store';
import type { SyncMode } from './store';
import { bootstrap } from './store/bootstrap';
import {
  addPoint,
  clearPoint,
  emptyPath,
  logPoint,
  retimePoint,
  setLocked,
  startPoint,
  unlogPoint,
} from './store/mutations';
import { seedRouteNumber } from './data/seed';
import { Atmosphere } from './components/Atmosphere';
import { Header } from './components/Header';
import { ModeToggle } from './components/ModeToggle';
import { DayNav } from './components/DayNav';
import { RouteStatus } from './components/RouteStatus';
import { PathView } from './components/PathView';
import { EmptyRoute } from './components/EmptyRoute';
import { Ledger } from './components/Ledger';
import { BuildMode } from './components/build/BuildMode';

export function App({ syncMode }: { syncMode: SyncMode }) {
  const { now, date: clockDate } = useNow();
  const today = toDateKey(clockDate);

  const [viewed, setViewed] = useState(today);
  const [previous, setPrevious] = useState<Path | null>(null);
  /**
   * The app always opens on the route. You never land in the workshop — you go
   * there deliberately, which is the whole point of it being a separate place.
   */
  const [building, setBuilding] = useState(false);

  const { settings } = useSettings();
  const { path, loading } = usePath(viewed);
  const projects = useProjects();
  // All of history, because the running total spans it. Daily records are tiny
  // and there is one per day; if this ever needs bounding, a rolled-up total
  // document replaces the sum rather than the window shrinking.
  const { days } = useDays(ALL_TIME, today);

  useEffect(() => {
    bootstrap(repository, today).then(() => runRollover(repository, today));
  }, [today]);

  // The most recent route before the one being viewed, offered for reuse when
  // this day is empty.
  useEffect(() => {
    let live = true;
    repository.listPaths(ALL_TIME, shiftDate(viewed, -1)).then((found) => {
      if (live) setPrevious(found.at(-1) ?? null);
    });
    return () => {
      live = false;
    };
  }, [viewed, path]);

  /**
   * Which point is holding an open offer. Deliberately session state and never
   * stored: an offer is where you are standing right now, not a fact about the
   * day. Persisting it would mean it reappearing on every reload after you'd
   * already declined, and syncing it would mean clearing a point on your phone
   * popping a prompt on your laptop.
   */
  const [offerFor, setOfferFor] = useState<string | null>(null);

  const route = useMemo(
    () => (path ? buildRoute(path, { now, offerFor, markerMode: settings.markerMode }) : null),
    [path, now, offerFor, settings.markerMode],
  );
  const ledger = useMemo(() => buildLedger(days, today), [days, today]);

  /**
   * Mutate, then write. The one place that will learn about the network.
   *
   * The day's ledger row is rewritten alongside the path, so the two can never
   * drift — un-logging a point takes its credit back, which is only correct
   * because the row is derived rather than incremented.
   */
  const commit = (next: Path) => {
    void repository.savePath(next);
    void repository.saveDay(dayRecordFor(next));
  };

  const withPath = (fn: (current: Path) => Path) => {
    if (path) commit(fn(path));
  };

  const clear = (id: string) => {
    if (!path) return;
    commit(clearPoint(path, id, now));
    // Clearing the live point is the only thing that ever raises the offer, and
    // only when there's something left to offer. Logging a point out of order
    // deliberately doesn't — you're recording history, not building momentum.
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
      version: (settings.version ?? 0) + 1,
      updatedAt: Date.now(),
    });

  /** One question in, one route out. Stays an ad-hoc point on purpose. */
  const startFromNothing = (firstThing: string) =>
    commit(
      addPoint(emptyPath(viewed), {
        title: firstThing,
        firstMove: firstThing,
        startsAt: viewed === today ? Math.ceil(now / 30) * 30 : 8 * 60,
        duration: { kind: 'fixed', minutes: 15 },
        type: 'physical',
        label: null,
      }),
    );

  const copyPrevious = () => {
    if (!previous) return;
    commit({
      ...emptyPath(viewed),
      endsAt: previous.endsAt,
      // A fresh copy: the plan carries over, the evidence of having walked it
      // does not. New ids, because these are new segments that happen to say
      // the same thing — sharing ids with yesterday's would make two different
      // days' records collide once they sync.
      segments: previous.segments.map((segment) =>
        segment.kind === 'point'
          ? { ...segment, id: newId(), startedAt: null, completedAt: null }
          : { ...segment, id: newId() },
      ),
    });
  };

  if (building) {
    return (
      <>
        <Atmosphere />
        <BuildMode syncMode={syncMode} onClose={() => setBuilding(false)} />
      </>
    );
  }

  const hasRoute = Boolean(path && path.segments.length > 0);

  return (
    <>
      <Atmosphere />
      <main className="shell">
        <Header date={clockDate} now={now} routeNumber={routeNumber(days)} />
        <div className="toprow">
          <ModeToggle />
          <button
            type="button"
            className="syncbtn"
            onClick={() => setBuilding(true)}
            aria-label="Open the workshop"
          >
            ⚙ BUILD
          </button>
        </div>
        <DayNav
          date={viewed}
          today={today}
          onChange={(next) => {
            setViewed(next);
            setOfferFor(null);
          }}
        />

        {hasRoute && path && route && (
          <>
            <RouteStatus
              cleared={route.cleared}
              total={route.total}
              future={viewed > today}
              lockedAt={path.lockedAt}
              markerMode={settings.markerMode}
              onToggleMarker={toggleMarker}
              onToggleLock={() =>
                withPath((current) => setLocked(current, current.lockedAt === null ? now : null))
              }
            />
            <PathView
              route={route}
              endsAt={path.endsAt}
              offerFor={offerFor}
              projects={projects}
              onStart={(id) => withPath((current) => startPoint(current, id, now))}
              onClear={clear}
              onLog={(id) => withPath((current) => logPoint(current, id, now))}
              onUnlog={(id) => withPath((current) => unlogPoint(current, id))}
              onAcceptOffer={acceptOffer}
              onDeclineOffer={declineOffer}
            />
          </>
        )}

        {!loading && !hasRoute && (
          <EmptyRoute
            previousLabel={previous ? labelFor(previous.date, today) : null}
            onStart={startFromNothing}
            onCopyPrevious={copyPrevious}
          />
        )}

        <Ledger view={ledger} />
      </main>
    </>
  );
}

/** Counts routes walked. Not days in a row — nothing here can be broken. */
function routeNumber(days: { pointsCleared: number }[]): number {
  return days.filter((day) => day.pointsCleared > 0).length || seedRouteNumber;
}

function labelFor(date: string, today: string): string {
  if (date === shiftDate(today, -1)) return 'yesterday';
  const [, month, day] = date.split('-').map(Number);
  return `${day}/${month}`;
}
