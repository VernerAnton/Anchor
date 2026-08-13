import { describe, expect, it } from 'vitest';
import type { Recurrence, Task } from '../types/task';
import { completeTask, emptyDayLog, setEntryCleared } from './mutations';

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

describe('setEntryCleared', () => {
  const DATE = '2026-08-10';

  it('records a clearing against the entry, not the task', () => {
    const log = setEntryCleared(null, DATE, 'entry-1', true, NOW);
    expect(log.cleared).toEqual({ 'entry-1': NOW });
    expect(log.date).toBe(DATE);
  });

  // The whole reason completion lives here: two placements, one task.
  it('leaves other placements of the same task alone', () => {
    const morning = setEntryCleared(null, DATE, 'am', true, NOW);
    expect(morning.cleared).toEqual({ am: NOW });
    const both = setEntryCleared(morning, DATE, 'pm', true, NOW + 1);
    expect(both.cleared).toEqual({ am: NOW, pm: NOW + 1 });
  });

  // "This didn't happen" is the absence of a record, not a record of absence.
  it('removes the key when un-cleared rather than storing a falsy value', () => {
    const cleared = setEntryCleared(null, DATE, 'am', true, NOW);
    const undone = setEntryCleared(cleared, DATE, 'am', false);
    expect(undone.cleared).toEqual({});
    expect('am' in undone.cleared).toBe(false);
  });

  it('bumps the version so a stale echo cannot overwrite it', () => {
    const first = setEntryCleared(null, DATE, 'am', true, NOW);
    const second = setEntryCleared(first, DATE, 'pm', true, NOW);
    expect(second.version).toBeGreaterThan(first.version);
  });

  it('keeps whatever was in the wildcards untouched', () => {
    const seeded = { ...emptyDayLog(DATE), wildcards: { w1: ['task-a'] } };
    expect(setEntryCleared(seeded, DATE, 'am', true, NOW).wildcards).toEqual({ w1: ['task-a'] });
  });
});
