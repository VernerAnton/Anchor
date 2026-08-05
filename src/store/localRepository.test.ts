import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalRepository } from './localRepository';
import { localKey, tasksCollection } from './keys';
import { describeRecurrence } from '../lib/recurrence';

/**
 * The local backend is the only copy of the data for anyone not using cloud
 * sync, and stored records go stale the moment the model moves on. These pin
 * the rule that stops that being a white screen: reads validate, so a record
 * written by an older build is upgraded before any component sees it.
 */

const USER = 'local';

// Minimal localStorage, enough for the repository's scan-and-read.
function installStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const mock = {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', mock);
  vi.stubGlobal('window', { addEventListener: () => {} });
  return store;
}

function staleTask(recurrence: unknown) {
  return JSON.stringify({
    id: 'task-1',
    title: 'Pay day chores',
    notes: null,
    projectId: 'proj-1',
    parentId: null,
    priority: null,
    dueDate: '2026-08-15',
    recurrence,
    completedAt: null,
    order: 0,
    archived: false,
    firstMove: null,
    type: null,
    defaultDuration: null,
    schemaVersion: 1,
    version: 2,
    updatedAt: 1,
  });
}

beforeEach(() => vi.unstubAllGlobals());

describe('local reads upgrade stale records', () => {
  it('upgrades a monthly rule saved with a single `day`', async () => {
    // The exact shape that white-screened the app: `days` did not exist yet.
    installStorage({
      [`${localKey(tasksCollection(USER))}:task-1`]: staleTask({
        freq: 'monthlyByDate',
        day: 15,
        interval: 1,
        anchor: null,
        mode: 'grid',
      }),
    });

    const [task] = await createLocalRepository(USER).getTasks();
    expect(task).toBeDefined();
    expect(task!.recurrence).toMatchObject({ freq: 'monthlyByDate', days: [15] });
    // The crash was here — rendering the rule, not reading it.
    expect(() => describeRecurrence(task!.recurrence!)).not.toThrow();
  });

  it('upgrades a first-generation `kind` rule', async () => {
    installStorage({
      [`${localKey(tasksCollection(USER))}:task-1`]: staleTask({ kind: 'everyNDays', n: 3 }),
    });

    const [task] = await createLocalRepository(USER).getTasks();
    expect(task!.recurrence).toMatchObject({ freq: 'daily', interval: 3 });
    expect(() => describeRecurrence(task!.recurrence!)).not.toThrow();
  });

  it('keeps a task whose rule is beyond repair, dropping only the rule', async () => {
    installStorage({
      [`${localKey(tasksCollection(USER))}:task-1`]: staleTask({ freq: 'nonsense' }),
    });

    const [task] = await createLocalRepository(USER).getTasks();
    expect(task!.title).toBe('Pay day chores');
    expect(task!.recurrence).toBeNull();
  });

  it('reads a record that needs no upgrading unchanged', async () => {
    installStorage({
      [`${localKey(tasksCollection(USER))}:task-1`]: staleTask(null),
    });

    const [task] = await createLocalRepository(USER).getTasks();
    expect(task!.title).toBe('Pay day chores');
    expect(task!.dueDate).toBe('2026-08-15');
  });
});
