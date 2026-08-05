import { describe, expect, it } from 'vitest';
import type { Recurrence, Task } from '../types/task';
import { completeTask } from './mutations';

const NOW = 1_800_000_000_000;
const TODAY = '2026-08-04';

function taskWith(recurrence: Recurrence | null, dueDate: string | null): Task {
  return {
    id: 't1',
    title: 'Water the plants',
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate,
    recurrence,
    completedAt: null,
    order: 0,
    archived: false,
    firstMove: null,
    type: null,
    defaultDuration: null,
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
  };
}

const daily = (extra: Partial<Recurrence> = {}): Recurrence =>
  ({
    freq: 'daily',
    interval: 1,
    anchor: null,
    mode: 'fromCompletion',
    until: null,
    remaining: null,
    ...extra,
  }) as Recurrence;

describe('completeTask with end conditions', () => {
  it('decrements remaining on each completion', () => {
    const done = completeTask(taskWith(daily({ remaining: 3 }), TODAY), NOW, TODAY);
    expect(done.completedAt).toBeNull();
    expect(done.dueDate).toBe('2026-08-05');
    expect(done.recurrence).toMatchObject({ remaining: 2 });
  });

  it('the last repeat closes the task like a non-recurring one', () => {
    const done = completeTask(taskWith(daily({ remaining: 1 }), TODAY), NOW, TODAY);
    expect(done.completedAt).toBe(NOW);
    // The rule stays as a record of how it used to repeat.
    expect(done.recurrence).not.toBeNull();
  });

  it('a rule past its until-date closes the task', () => {
    const done = completeTask(taskWith(daily({ until: TODAY }), TODAY), NOW, TODAY);
    expect(done.completedAt).toBe(NOW);
  });

  it('an unlimited rule never touches completedAt', () => {
    const done = completeTask(taskWith(daily(), TODAY), NOW, TODAY);
    expect(done.completedAt).toBeNull();
    expect(done.dueDate).toBe('2026-08-05');
  });
});
