import type { AnchorRepository } from './repository';
import { createLocalRepository } from './localRepository';
import { LOCAL_USER_ID } from './identity';
import { isSample } from '../lib/sampleData';

/**
 * One-time push of this device's local data into the cloud, run when a sync
 * key is first set. It keeps the property that made the original safe: **an
 * empty device can never wipe existing cloud data.** Nothing is deleted, and a
 * cloud document is only overwritten when the local copy carries a strictly
 * higher version.
 *
 * Sample documents stay behind: they're for trying the app on one device, not
 * for filling a shared store that every other device will then show.
 */
export async function migrateLocalToCloud(cloud: AnchorRepository): Promise<number> {
  const local = createLocalRepository(LOCAL_USER_ID);
  const [tasks, projects, labels, settings] = await Promise.all([
    local.getTasks(),
    local.getProjects(),
    local.getLabels(),
    local.getSettings(),
  ]);
  const [cloudTasks, cloudProjects, cloudLabels, cloudSettings] = await Promise.all([
    cloud.getTasks(),
    cloud.getProjects(),
    cloud.getLabels(),
    cloud.getSettings(),
  ]);

  let pushed = 0;
  const pushNewer = async <T extends { id: string; version: number }>(
    mine: T[],
    theirs: T[],
    save: (doc: T) => Promise<void>,
  ) => {
    const versions = new Map(theirs.map((doc) => [doc.id, doc.version]));
    for (const doc of mine) {
      if (isSample(doc.id)) continue;
      const existing = versions.get(doc.id);
      if (existing === undefined || existing < doc.version) {
        await save(doc);
        pushed += 1;
      }
    }
  };

  await pushNewer(projects, cloudProjects, (p) => cloud.saveProject(p));
  await pushNewer(labels, cloudLabels, (l) => cloud.saveLabel(l));
  await pushNewer(tasks, cloudTasks, (t) => cloud.saveTask(t));
  if (settings && (cloudSettings === null || cloudSettings.version < settings.version)) {
    await cloud.saveSettings(settings);
  }
  return pushed;
}
