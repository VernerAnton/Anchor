import { describe, expect, it } from 'vitest';
import { allTasksView, focusAfterToggle, taskDetail } from './views';
import { emptyTaskDraft, newTask } from '../store/mutations';
import type { Task } from '../types/task';

function task(overrides: Partial<Task>): Task {
  return { ...newTask({ ...emptyTaskDraft(), title: 'Task' }, 1, 0), ...overrides };
}

describe('allTasksView', () => {
  it('splits open from completed and hands rows a decided status', () => {
    const view = allTasksView([
      task({ id: 'a', title: 'Open one' }),
      task({ id: 'b', title: 'Done one', completedAt: 100 }),
    ]);
    expect(view.open).toEqual([{ id: 'a', title: 'Open one', status: 'open' }]);
    expect(view.completed).toEqual([{ id: 'b', title: 'Done one', status: 'done' }]);
  });

  it('orders open tasks by manual order, then title, then id', () => {
    const view = allTasksView([
      task({ id: 'c', title: 'Same', order: 2 }),
      task({ id: 'b', title: 'Same', order: 2 }),
      task({ id: 'a', title: 'Zebra', order: 1 }),
      task({ id: 'd', title: 'Apple', order: 2 }),
    ]);
    expect(view.open.map((row) => row.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('lists completed tasks newest first', () => {
    const view = allTasksView([
      task({ id: 'old', completedAt: 1 }),
      task({ id: 'new', completedAt: 3 }),
      task({ id: 'mid', completedAt: 2 }),
    ]);
    expect(view.completed.map((row) => row.id)).toEqual(['new', 'mid', 'old']);
  });

  it('leaves archived tasks out', () => {
    expect(allTasksView([task({ archived: true })]).open).toEqual([]);
  });
});

describe('taskDetail', () => {
  it('is null when nothing is selected or the task has gone', () => {
    const tasks = [task({ id: 'a' })];
    expect(taskDetail(tasks, null)).toBeNull();
    expect(taskDetail(tasks, 'missing')).toBeNull();
    expect(taskDetail(tasks, 'a')?.status).toBe('open');
  });
});

describe('focusAfterToggle', () => {
  const list = allTasksView([
    task({ id: 'a', order: 1 }),
    task({ id: 'b', order: 2 }),
    task({ id: 'c', order: 3 }),
    task({ id: 'd', completedAt: 1 }),
  ]);

  it('hands focus to the row that takes the completed one’s place', () => {
    expect(focusAfterToggle(list, 'b', true)).toBe('c');
    expect(focusAfterToggle(list, 'c', true)).toBe('b');
  });

  it('follows a reopened row, and gives up when the list empties', () => {
    expect(focusAfterToggle(list, 'd', false)).toBe('d');
    const single = allTasksView([task({ id: 'only' })]);
    expect(focusAfterToggle(single, 'only', true)).toBeNull();
  });
});
