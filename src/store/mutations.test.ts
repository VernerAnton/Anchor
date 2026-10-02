import { describe, expect, it } from 'vitest';
import { completeTask, editTask, emptyTaskDraft, newTask, nextOrder, refileTask, reopenTask } from './mutations';

const fresh = () => newTask({ ...emptyTaskDraft(), title: 'Water the plants' }, 1, 1000);

describe('newTask', () => {
  it('sets every absent value to an explicit null, never undefined', () => {
    const task = fresh();
    for (const value of Object.values(task)) expect(value).not.toBeUndefined();
    expect(task.notes).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.version).toBe(1);
  });
});

describe('writes bump the version synchronously', () => {
  it('complete, reopen and edit each move the version up by one', () => {
    const done = completeTask(fresh(), 2000);
    expect(done.completedAt).toBe(2000);
    expect(done.version).toBe(2);

    const reopened = reopenTask(done, 3000);
    expect(reopened.completedAt).toBeNull();
    expect(reopened.version).toBe(3);

    expect(editTask(reopened, { title: 'Water the ferns' }, 4000).version).toBe(4);
  });
});

describe('nextOrder', () => {
  it('places a new task after the last one', () => {
    expect(nextOrder([])).toBe(1);
    expect(nextOrder([{ ...fresh(), order: 7 }, { ...fresh(), order: 3 }])).toBe(8);
  });
});

describe('refileTask', () => {
  it('moves a task’s subtasks with it, and only touches what changes', () => {
    const parent = { ...fresh(), id: 'p', projectId: 'old' };
    const sub = { ...fresh(), id: 's', parentId: 'p', projectId: 'old' };
    const alreadyThere = { ...fresh(), id: 't', parentId: 'p', projectId: 'new' };
    const moved = refileTask(parent, [sub, alreadyThere], 'new', 9);
    expect(moved.map((t) => [t.id, t.projectId, t.version])).toEqual([
      ['p', 'new', 2],
      ['s', 'new', 2],
    ]);
  });
});
