import type { DayRecord, Path } from '../types/path';
import { SCHEMA_VERSION } from '../store/keys';

/**
 * The ledger row a day's path implies.
 *
 * Derived rather than counted up as you go, which makes writing it idempotent:
 * two devices that both record the same day compute the same number, so
 * last-write-wins can't double-count. A2's rollover — catching days the app was
 * never opened on — reuses this for exactly that reason.
 */
export function dayRecordFor(path: Path): DayRecord {
  const pointsCleared = path.segments.filter(
    (segment) => segment.kind === 'point' && segment.completedAt !== null,
  ).length;

  return {
    date: path.date,
    pointsCleared,
    schemaVersion: SCHEMA_VERSION,
    // The path's own version, not a fresh counter: two devices holding the
    // same path state derive byte-identical records, and a newer path state
    // always carries the higher version. Monotonic and idempotent at once.
    version: path.version,
    updatedAt: Date.now(),
  };
}
