import { defaultSettings } from '../types/settings';
import { buildSeedDays, buildSeedPath } from '../data/seed';
import type { AnchorRepository } from './repository';

/**
 * Populates a genuinely empty install, once.
 *
 * The settings document doubles as the "this install has been initialised"
 * marker. Keying off it rather than off today's path matters: a missing path
 * for today is the normal state of every new morning, and seeding on that would
 * quietly overwrite a real day with the demo one.
 */
export async function bootstrap(repository: AnchorRepository, today: string): Promise<void> {
  if (await repository.getSettings()) return;

  await Promise.all([
    repository.savePath(buildSeedPath(today)),
    ...buildSeedDays(today).map((day) => repository.saveDay(day)),
  ]);

  // Written last, so an interrupted bootstrap is retried rather than left
  // half-populated and marked done.
  await repository.saveSettings(defaultSettings());
}
