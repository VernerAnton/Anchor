import type { DayRecord } from '../types/path';
import { shiftDate } from './time';

export const WINDOW_DAYS = 14;

/**
 * Far enough back to mean "everything". The running total has to be computed
 * over all of history, not just the visible window — a total that shrank as old
 * days aged out would be a chain by another name.
 */
export const ALL_TIME = '1970-01-01';

export type DayMark = 'hit' | 'gap' | 'today';

export interface LedgerView {
  /** Running total. Only ever goes up. */
  total: number;
  /** Days with at least one point cleared, within the window. */
  hits: number;
  windowDays: number;
  marks: DayMark[];
  /** Positive if the recent half of the window beats the earlier half. */
  trend: number;
}

/**
 * The rolling window, deliberately not a streak.
 *
 * There is no consecutive-day counter anywhere in here, and no value that a
 * gap can reset. A gap contributes nothing and costs nothing — the window
 * simply moves on, and yesterday's zero has no power over today.
 *
 * The window is built forward from the calendar rather than from whichever days
 * happen to have records, so a day you never opened the app is a gap in a fixed
 * fourteen rather than a day that quietly doesn't count. The denominator never
 * moves.
 */
export function buildLedger(records: DayRecord[], today: string, carriedTotal = 0): LedgerView {
  const byDate = new Map(records.map((record) => [record.date, record.pointsCleared]));

  const window = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = shiftDate(today, i - (WINDOW_DAYS - 1));
    return { date, cleared: byDate.get(date) ?? 0 };
  });

  const marks: DayMark[] = window.map((day) =>
    day.date === today ? 'today' : day.cleared > 0 ? 'hit' : 'gap',
  );

  const total = carriedTotal + records.reduce((sum, record) => sum + record.pointsCleared, 0);
  const hits = window.filter((day) => day.cleared > 0).length;

  // Trajectory, not judgement — the research is clear that some progress
  // signal helps, and that punishment doesn't.
  const half = Math.floor(WINDOW_DAYS / 2);
  const earlier = window.slice(0, half).filter((day) => day.cleared > 0).length;
  const recent = window.slice(half).filter((day) => day.cleared > 0).length;

  return { total, hits, windowDays: WINDOW_DAYS, marks, trend: recent - earlier };
}
