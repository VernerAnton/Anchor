import type { AnchorRepository } from './repository';
import { createLocalRepository } from './localRepository';
import { LOCAL_USER_ID } from './identity';
import { ALL_TIME } from '../lib/ledger';

const FAR_FUTURE = '9999-12-31';

/**
 * One-time push of this device's local data into the cloud, run when a sync
 * key is first set. Ported from the working app's migrateLocalToCloud, and it
 * keeps the property that made that one safe: **an empty device can never wipe
 * existing cloud data.** Nothing is deleted, and a cloud document is only
 * overwritten when the local copy carries a strictly higher version.
 *
 * Written purely against the repository interface, so it needs to know nothing
 * about either backend.
 */
export async function migrateLocalToCloud(cloud: AnchorRepository): Promise<void> {
  const local = createLocalRepository(LOCAL_USER_ID);

  const [paths, days, settings] = await Promise.all([
    local.listPaths(ALL_TIME, FAR_FUTURE),
    local.getDays(ALL_TIME, FAR_FUTURE),
    local.getSettings(),
  ]);

  for (const path of paths) {
    const existing = await cloud.getPath(path.date);
    if (existing === null || (existing.version ?? 0) < (path.version ?? 0)) {
      await cloud.savePath(path);
    }
  }

  const cloudDays = new Map(
    (await cloud.getDays(ALL_TIME, FAR_FUTURE)).map((d) => [d.date, d.version ?? 0]),
  );
  for (const day of days) {
    const existing = cloudDays.get(day.date);
    if (existing === undefined || existing < (day.version ?? 0)) {
      await cloud.saveDay(day);
    }
  }

  if (settings) {
    const existing = await cloud.getSettings();
    if (existing === null || (existing.version ?? 0) < (settings.version ?? 0)) {
      await cloud.saveSettings(settings);
    }
  }
}
