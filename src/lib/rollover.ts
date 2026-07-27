import type { AnchorRepository } from '../store/repository';
import { dayRecordFor } from './dayRecord';
import { ALL_TIME } from './ledger';
import { shiftDate } from './time';

/**
 * Reconciles finished days against the ledger.
 *
 * Day records are written as points are cleared, so this is a self-heal rather
 * than the only path to a correct ledger: it catches days whose path was edited
 * after the fact, days written by an older build, and anything a half-finished
 * write left behind. Because the count is derived from the path rather than
 * incremented, running this twice — or on two devices at once — reaches the
 * same answer, so nothing can be double-counted.
 *
 * Only days strictly before today are touched. Today is still being lived and
 * is maintained by clearing points.
 *
 * @returns how many day records had to be corrected.
 */
export async function runRollover(
  repository: AnchorRepository,
  today: string,
): Promise<number> {
  const yesterday = shiftDate(today, -1);

  const [paths, days] = await Promise.all([
    repository.listPaths(ALL_TIME, yesterday),
    repository.getDays(ALL_TIME, yesterday),
  ]);

  const recorded = new Map(days.map((day) => [day.date, day.pointsCleared]));

  const corrections = paths
    .map(dayRecordFor)
    .filter((record) => recorded.get(record.date) !== record.pointsCleared);

  await Promise.all(corrections.map((record) => repository.saveDay(record)));
  return corrections.length;
}
