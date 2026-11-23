import { describe, expect, it } from 'vitest';
import {
  addTaskLabels,
  completeTask,
  editTask,
  emptyTaskDraft,
  newTask,
  nextOrder,
  refileTask,
  removeTaskLabel,
  reopenTask,
  setTaskRecurrence,
} from './mutations';

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
    const done = completeTask(fresh(), 2000, '2026-10-09');
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

describe('recurring tasks', () => {
  const weekly = {
    freq: 'weekly' as const,
    weekdays: [5], // Fridays
    count: 'weeks' as const,
    interval: 1,
    anchor: '2026-10-09',
    mode: 'grid' as const,
    until: null,
    remaining: null,
  };

  it('completing moves the date on and never sets completedAt', () => {
    const task = { ...fresh(), dueDate: '2026-10-09', recurrence: weekly };
    const done = completeTask(task, 1, '2026-10-09');
    expect(done.completedAt).toBeNull();
    expect(done.dueDate).toBe('2026-10-16');
  });

  it('done late measures from today, so nothing backfills', () => {
    const task = { ...fresh(), dueDate: '2026-09-04', recurrence: weekly };
    expect(completeTask(task, 1, '2026-10-07').dueDate).toBe('2026-10-09');
  });

  it('the last repeat closes the task like any other', () => {
    const task = { ...fresh(), dueDate: '2026-10-09', recurrence: { ...weekly, remaining: 1 } };
    expect(completeTask(task, 7, '2026-10-09').completedAt).toBe(7);
  });

  it('a rule set on an undated task gives it its first date', () => {
    const set = setTaskRecurrence(fresh(), { ...weekly, anchor: null }, '2026-10-07', 1);
    expect(set.dueDate).toBe('2026-10-09');
    expect(set.recurrence?.anchor).toBe('2026-10-07');
    const today = setTaskRecurrence(fresh(), { ...weekly, anchor: null }, '2026-10-09', 1);
    expect(today.dueDate).toBe('2026-10-09');
  });
});

describe('labels on tasks', () => {
  it('adds a pasted list in one write, skipping what is already there', () => {
    const task = { ...fresh(), labelIds: ['a'] };
    const next = addTaskLabels(task, ['a', 'b', 'c', 'b'], 1);
    expect(next.labelIds).toEqual(['a', 'b', 'c']);
    expect(next.version).toBe(task.version + 1);
    expect(addTaskLabels(task, ['a'], 1)).toBe(task);
  });

  it('removing a label it never had is a no-op', () => {
    const task = fresh();
    expect(removeTaskLabel(task, 'x', 1)).toBe(task);
  });
});
