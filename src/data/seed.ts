import type { DayRecord, Path } from '../types/path';
import { shiftDate } from '../lib/time';
import { SCHEMA_VERSION } from '../store/keys';

const at = (h: number, m: number) => h * 60 + m;

/**
 * The canonical mockup's route, as real data, used once to populate a fresh
 * install so the app has something to show before you've built a day of your
 * own. A3 replaces this with a proper empty state.
 *
 * Durations are kept verbatim from the mockup, which means rest doesn't tile
 * perfectly into the gaps between points — and that's deliberate rather than
 * an arithmetic slip. Rest is what you wrote down, not filler stretched to
 * fit; leaving genuine unscheduled slack is the point. A timeline with every
 * minute accounted for turns back into the oppressive list it replaced.
 */
export function buildSeedPath(date: string): Path {
  return {
    id: `path-${date}`,
    date,
    lockedAt: at(23, 0),
    endsAt: at(9, 30),
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    segments: [
      {
        kind: 'point',
        id: 'p1',
        title: 'Bag by the door',
        firstMove: 'Put the bag down by the door',
        startsAt: at(6, 0),
        duration: { kind: 'fixed', minutes: 2 },
        type: 'physical',
        label: null,
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
        label: null,
        startedAt: null,
        completedAt: null,
      },
      { kind: 'rest', id: 'r3', label: null, minutes: 15 },
      {
        // Underway but not yet cleared, so the momentum offer is one press away
        // rather than already open. The offer is session state and must not be
        // restored on reload, so seeding it open would have meant it reappearing
        // every refresh no matter how many times you declined it.
        kind: 'point',
        id: 'p4',
        title: 'Cut & cook the chicken',
        firstMove: 'Pick up the knife',
        startsAt: at(8, 5),
        duration: { kind: 'natural', estimateMinutes: 25 },
        type: 'physical',
        label: null,
        startedAt: at(8, 5),
        completedAt: null,
      },
      { kind: 'rest', id: 'r4', label: null, minutes: 15 },
      {
        kind: 'point',
        id: 'p5',
        title: 'ADM-201 — one Pomodoro',
        firstMove: 'Open the file, write one line',
        startsAt: at(8, 45),
        duration: { kind: 'fixed', minutes: 25 },
        type: 'abstract',
        label: null,
        startedAt: null,
        completedAt: null,
      },
    ],
  };
}

/**
 * The route's ordinal, shown in the header. Counts routes walked, not days
 * in a row — there is nothing here that can be broken by missing one.
 */
export const seedRouteNumber = 7;

/** Oldest to newest, 13 days back. Zero means a gap — it costs nothing. */
const PAST_DAYS = [4, 5, 0, 3, 6, 0, 5, 0, 4, 6, 0, 5, 0];

export function buildSeedDays(today: string): DayRecord[] {
  return PAST_DAYS.map((pointsCleared, i) => ({
    date: shiftDate(today, i - PAST_DAYS.length),
    pointsCleared,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
  }));
}

/**
 * Points cleared before the rolling window starts. The running total has to
 * outlive the window — it only ever goes up, and nothing resets it.
 */
export const seedCarriedTotal = 0;
