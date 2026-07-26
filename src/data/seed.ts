import type { DayRecord, Path } from '../types/path';
import { toDateKey } from '../lib/time';

const at = (h: number, m: number) => h * 60 + m;

/**
 * The canonical mockup's route, as real data.
 *
 * Durations are kept verbatim from the mockup, which means rest doesn't tile
 * perfectly into the gaps between points — and that's deliberate rather than
 * an arithmetic slip. Rest is what you wrote down, not filler stretched to
 * fit; leaving genuine unscheduled slack is the point. A timeline with every
 * minute accounted for turns back into the oppressive list it replaced.
 */
export const seedPath: Path = {
  id: 'route-07',
  date: toDateKey(),
  lockedAt: at(23, 0),
  endsAt: at(9, 30),
  markerMode: 'live',
  segments: [
    {
      kind: 'point',
      id: 'p1',
      title: 'Bag by the door',
      firstMove: 'Put the bag down by the door',
      startsAt: at(6, 0),
      duration: { kind: 'fixed', minutes: 2 },
      type: 'physical',
      startedAt: at(6, 0),
      completedAt: at(6, 2),
    },
    { kind: 'rest', id: 'r1', label: 'COFFEE', minutes: 20 },
    {
      kind: 'point',
      id: 'p2',
      title: 'Walk + gym session',
      firstMove: 'Shoes on, out the door',
      startsAt: at(6, 25),
      duration: { kind: 'fixed', minutes: 55 },
      type: 'physical',
      label: 'MOVEMENT',
      startedAt: at(6, 25),
      completedAt: at(7, 18),
    },
    { kind: 'rest', id: 'r2', label: 'SHOWER, EAT', minutes: 40 },
    {
      kind: 'point',
      id: 'p3',
      title: 'Inbox sweep',
      firstMove: 'Open the inbox, read one',
      startsAt: at(7, 40),
      duration: { kind: 'fixed', minutes: 20 },
      type: 'abstract',
      startedAt: null,
      completedAt: null,
    },
    { kind: 'rest', id: 'r3', minutes: 15 },
    {
      kind: 'point',
      id: 'p4',
      title: 'Cut & cook the chicken',
      firstMove: 'Pick up the knife',
      startsAt: at(8, 5),
      duration: { kind: 'natural', estimateMinutes: 25 },
      type: 'physical',
      startedAt: at(8, 5),
      completedAt: at(8, 10),
    },
    { kind: 'rest', id: 'r4', minutes: 15 },
    {
      kind: 'point',
      id: 'p5',
      title: 'ADM-201 — one Pomodoro',
      firstMove: 'Open the file, write one line',
      startsAt: at(8, 45),
      duration: { kind: 'fixed', minutes: 25 },
      type: 'abstract',
      startedAt: null,
      completedAt: null,
    },
  ],
};

/**
 * The route's ordinal, shown in the header. Counts routes walked, not days
 * in a row — there is nothing here that can be broken by missing one.
 */
export const seedRouteNumber = 7;

/**
 * A momentum offer already open on p4, so the app boots into the exact state
 * the canonical mockup illustrates. In normal use this starts null and is set
 * by completing a point.
 */
export const seedOfferFor = 'p4';

/** Oldest to newest, 13 days back. Zero means a gap — it costs nothing. */
const PAST_DAYS = [4, 5, 0, 3, 6, 0, 5, 0, 4, 6, 0, 5, 0];

export const seedLedger: DayRecord[] = [
  ...PAST_DAYS.map((pointsCleared, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (PAST_DAYS.length - i));
    return { date: toDateKey(d), pointsCleared };
  }),
  { date: toDateKey(), pointsCleared: 3 },
];

/**
 * Points cleared before the rolling window starts. The running total has to
 * outlive the window — it only ever goes up, and nothing resets it.
 */
export const seedCarriedTotal = 0;
