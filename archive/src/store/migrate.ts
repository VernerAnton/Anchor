import type { AnchorRepository } from './repository';
import { createLocalRepository } from './localRepository';
import { LOCAL_USER_ID } from './identity';

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

  const [tasks, projects, settings] = await Promise.all([
    local.getTasks(),
    local.getProjects(),
    local.getSettings(),
  ]);

  const cloudTasks = new Map((await cloud.getTasks()).map((t) => [t.id, t.version ?? 0]));
  for (const task of tasks) {
    const existing = cloudTasks.get(task.id);
    if (existing === undefined || existing < (task.version ?? 0)) {
      await cloud.saveTask(task);
    }
  }

  const cloudProjects = new Map((await cloud.getProjects()).map((p) => [p.id, p.version ?? 0]));
  for (const project of projects) {
    const existing = cloudProjects.get(project.id);
    if (existing === undefined || existing < (project.version ?? 0)) {
      await cloud.saveProject(project);
    }
  }

  if (settings) {
    const existing = await cloud.getSettings();
    if (existing === null || (existing.version ?? 0) < (settings.version ?? 0)) {
      await cloud.saveSettings(settings);
    }
  }
}
