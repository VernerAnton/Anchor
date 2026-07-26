import type { DayRecord } from '../types/path';
import { toDateKey } from './time';

export const WINDOW_DAYS = 14;

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
 */
export function buildLedger(records: DayRecord[], carriedTotal = 0): LedgerView {
  const today = toDateKey();
  const window = records.slice(-WINDOW_DAYS);

  const marks: DayMark[] = window.map((r) =>
    r.date === today ? 'today' : r.pointsCleared > 0 ? 'hit' : 'gap',
  );

  const total = carriedTotal + records.reduce((sum, r) => sum + r.pointsCleared, 0);
  const hits = window.filter((r) => r.pointsCleared > 0).length;

  // Trajectory, not judgement — the research is clear that some progress
  // signal helps, and that punishment doesn't.
  const half = Math.floor(window.length / 2);
  const earlier = window.slice(0, half).filter((r) => r.pointsCleared > 0).length;
  const recent = window.slice(half).filter((r) => r.pointsCleared > 0).length;

  return { total, hits, windowDays: window.length, marks, trend: recent - earlier };
}
