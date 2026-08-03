import { useEffect, useMemo, useState } from 'react';
import type { Path, Point, Rest } from './types/path';
import { buildRoute } from './lib/route';
import { ALL_TIME, buildLedger } from './lib/ledger';
import { dayRecordFor } from './lib/dayRecord';
import { newId } from './lib/id';
import { runRollover } from './lib/rollover';
import { shiftDate, toDateKey } from './lib/time';
import { useNow } from './hooks/useNow';
import { useDays, usePath, useSettings } from './hooks/useStore';
import { repository } from './store';
import { bootstrap } from './store/bootstrap';
import type { PointDraft } from './store/mutations';
import {
  addPoint,
  addRest,
  clearPoint,
  emptyPath,
  moveSegment,
  removeSegment,
  retimePoint,
  setLocked,
  startPoint,
  updatePoint,
  updateRest,
} from './store/mutations';
import type { SyncMode } from './store';
import { Atmosphere } from './components/Atmosphere';
import { SyncSettings } from './components/SyncSettings';
import { Header } from './components/Header';
import { ModeToggle } from './components/ModeToggle';
import { DayNav } from './components/DayNav';
import { RouteStatus } from './components/RouteStatus';
import { PathView } from './components/PathView';
import { PointEditor } from './components/PointEditor';
import { RestEditor } from './components/RestEditor';
import { EmptyRoute } from './components/EmptyRoute';
import { Ledger } from './components/Ledger';

/** Which editor is open, if any. */
type Editing =
  | { kind: 'none' }
  | { kind: 'point'; id: string | null }
  | { kind: 'rest'; id: string | null };

export function App({ syncMode }: { syncMode: SyncMode }) {
  const { now, date: clockDate } = useNow();
  const today = toDateKey(clockDate);

  const [viewed, setViewed] = useState(today);
  const [arranging, setArranging] = useState(false);
  const [editor, setEditor] = useState<Editing>({ kind: 'none' });
  const [previous, setPrevious] = useState<Path | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const { settings } = useSettings();
  const { path, loading } = usePath(viewed);
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
   * drift — deleting a cleared point takes its credit with it, which is only
   * correct because the row is derived rather than incremented.
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
      version: (settings.version ?? 0) + 1,
      updatedAt: Date.now(),
    });

  const saveDraft = (draft: PointDraft) => {
    const id = editor.kind === 'point' ? editor.id : null;
    const base = path ?? emptyPath(viewed);
    commit(id ? updatePoint(base, id, draft) : addPoint(base, draft));
    setEditor({ kind: 'none' });
  };

  const saveRest = (minutes: number, label: string | null) => {
    const id = editor.kind === 'rest' ? editor.id : null;
    const base = path ?? emptyPath(viewed);
    commit(id ? updateRest(base, id, minutes, label) : addRest(base, minutes, label));
    setEditor({ kind: 'none' });
  };

  /** One question in, one route out. */
  const startFromNothing = (firstThing: string) =>
    commit(
      addPoint(emptyPath(viewed), {
        title: firstThing,
        firstMove: firstThing,
        startsAt: defaultStart(viewed === today ? now : 8 * 60, null),
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

  const editingSegment =
    editor.kind === 'point' && editor.id
      ? (path?.segments.find((s) => s.id === editor.id) as Point | undefined)
      : editor.kind === 'rest' && editor.id
        ? (path?.segments.find((s) => s.id === editor.id) as Rest | undefined)
        : undefined;

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
            className={`syncbtn${syncMode === 'cloud' ? ' cloud' : ''}`}
            onClick={() => setSyncOpen((open) => !open)}
            aria-expanded={syncOpen}
          >
            {syncMode === 'cloud' ? 'SYNC · ON' : 'SYNC'}
          </button>
        </div>
        {syncOpen && <SyncSettings mode={syncMode} onClose={() => setSyncOpen(false)} />}
        <DayNav
          date={viewed}
          today={today}
          editing={arranging}
          onChange={(next) => {
            setViewed(next);
            setEditor({ kind: 'none' });
            setOfferFor(null);
          }}
          onToggleEditing={() => {
            setArranging((on) => !on);
            setEditor({ kind: 'none' });
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
              editing={arranging}
              onStart={(id) => withPath((current) => startPoint(current, id, now))}
              onClear={clear}
              onAcceptOffer={acceptOffer}
              onDeclineOffer={declineOffer}
              onEditSegment={(id) => {
                const segment = path.segments.find((s) => s.id === id);
                setEditor({ kind: segment?.kind === 'rest' ? 'rest' : 'point', id });
              }}
              onMoveSegment={(id, direction) =>
                withPath((current) => moveSegment(current, id, direction))
              }
              onRemoveSegment={(id) => withPath((current) => removeSegment(current, id))}
            />
          </>
        )}

        {editor.kind === 'point' && (
          <PointEditor
            point={(editingSegment as Point | undefined) ?? null}
            defaultStartsAt={defaultStart(viewed === today ? now : 8 * 60, path)}
            onSave={saveDraft}
            onCancel={() => setEditor({ kind: 'none' })}
          />
        )}
        {editor.kind === 'rest' && (
          <RestEditor
            rest={(editingSegment as Rest | undefined) ?? null}
            onSave={saveRest}
            onCancel={() => setEditor({ kind: 'none' })}
          />
        )}

        {arranging && editor.kind === 'none' && (
          <div className="adders">
            <button type="button" onClick={() => setEditor({ kind: 'point', id: null })}>
              + Point
            </button>
            <button type="button" onClick={() => setEditor({ kind: 'rest', id: null })}>
              + Rest
            </button>
          </div>
        )}

        {!loading && !hasRoute && editor.kind === 'none' && (
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
  return days.filter((day) => day.pointsCleared > 0).length;
}

/** A new point lands after whatever is already there, on the next half hour. */
function defaultStart(fallback: number, path: Path | null): number {
  const points = path?.segments.filter((s) => s.kind === 'point') ?? [];
  const last = points.at(-1);
  const base = last ? last.startsAt + 30 : fallback;
  return Math.min(23 * 60 + 30, Math.ceil(base / 30) * 30);
}

function labelFor(date: string, today: string): string {
  if (date === shiftDate(today, -1)) return 'yesterday';
  const [, month, day] = date.split('-').map(Number);
  return `${day}/${month}`;
}
