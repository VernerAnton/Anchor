import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalRepository } from './localRepository';
import { localKey, taskDoc } from './keys';
import { completeTask, emptyTaskDraft, newTask } from './mutations';
import type { Task } from '../types/task';

const USER = 'local';

function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { addEventListener: () => {} });
  return store;
}

const sample = () => newTask({ ...emptyTaskDraft(), title: 'Call the bank' }, 1, 0);

describe('local repository', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  it('delivers the first callback asynchronously, never during subscribe', async () => {
    const repo = createLocalRepository(USER);
    const cb = vi.fn();
    repo.subscribeTasks(cb);
    expect(cb).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledWith([]);
  });

  it('pushes saves and deletes to subscribers', async () => {
    const repo = createLocalRepository(USER);
    const seen: Task[][] = [];
    repo.subscribeTasks((tasks) => seen.push(tasks));
    await Promise.resolve();

    const task = sample();
    await repo.saveTask(task);
    expect(seen.at(-1)?.map((t) => t.id)).toEqual([task.id]);

    await repo.deleteTask(task.id);
    expect(seen.at(-1)).toEqual([]);
  });

  it('refuses a write carrying a lower version than what is stored', async () => {
    const repo = createLocalRepository(USER);
    const task = sample();
    const done = completeTask(task, 5, '2026-10-09');
    await repo.saveTask(done);
    await repo.saveTask(task); // a stale echo of the earlier version
    const [stored] = await repo.getTasks();
    expect(stored?.completedAt).toBe(5);
  });

  it('drops an invalid document rather than handing it to the app', async () => {
    store.set(localKey(taskDoc(USER, 'bad')), JSON.stringify({ id: 'bad' }));
    store.set(localKey(taskDoc(USER, 'junk')), '{not json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const repo = createLocalRepository(USER);
    expect(await repo.getTasks()).toEqual([]);
    warn.mockRestore();
  });

  it('stops calling back once unsubscribed', async () => {
    const repo = createLocalRepository(USER);
    const cb = vi.fn();
    repo.subscribeTasks(cb)();
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });
});
