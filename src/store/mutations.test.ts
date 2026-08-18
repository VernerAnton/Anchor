import { describe, expect, it } from 'vitest';
import type { Recurrence, Task } from '../types/task';
import {
  completeTask,
  editEntry,
  emptyDayLog,
  entriesOn,
  insertEntry,
  moveEntry,
  removeEntry,
  restEntry,
  setEntryCleared,
  setWildcardTasks,
  stripLabel,
  toggleTaskLabel,
  taskEntry,
  wildcardEntry,
} from './mutations';
import type { PathPattern } from '../types/path';

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
    labelIds: [],
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

describe('the week pattern', () => {
  const MON = 1;
  const a = restEntry('a', 10);
  const b = restEntry('b', 20);
  const c = restEntry('c', 30);
  const labels = (pattern: PathPattern) =>
    entriesOn(pattern, MON).map((entry) => (entry.kind === 'rest' ? entry.label : entry.kind));

  const week = () =>
    [a, b, c].reduce<PathPattern | null>(
      (pattern, entry) => insertEntry(pattern, MON, Number.MAX_SAFE_INTEGER, entry),
      null,
    )!;

  it('builds a day from nothing, appending in order', () => {
    expect(labels(week())).toEqual(['a', 'b', 'c']);
  });

  it('inserts at a position, and clamps one past the end', () => {
    expect(labels(insertEntry(week(), MON, 1, restEntry('x', 5)))).toEqual(['a', 'x', 'b', 'c']);
    expect(labels(insertEntry(week(), MON, 99, restEntry('x', 5)))).toEqual(['a', 'b', 'c', 'x']);
    expect(labels(insertEntry(week(), MON, -3, restEntry('x', 5)))).toEqual(['x', 'a', 'b', 'c']);
  });

  it('removes by entry id', () => {
    expect(labels(removeEntry(week(), MON, b.id))).toEqual(['a', 'c']);
  });

  it('moves down into the gap below, accounting for the lift', () => {
    expect(labels(moveEntry(week(), MON, 0, 2))).toEqual(['b', 'a', 'c']);
    expect(labels(moveEntry(week(), MON, 0, 3))).toEqual(['b', 'c', 'a']);
  });

  it('moves up', () => {
    expect(labels(moveEntry(week(), MON, 2, 0))).toEqual(['c', 'a', 'b']);
  });

  it('a move that goes nowhere leaves the order alone', () => {
    expect(labels(moveEntry(week(), MON, 1, 1))).toEqual(['a', 'b', 'c']);
    expect(labels(moveEntry(week(), MON, 1, 2))).toEqual(['a', 'b', 'c']);
  });

  it('an out-of-range move changes nothing', () => {
    expect(labels(moveEntry(week(), MON, 9, 0))).toEqual(['a', 'b', 'c']);
  });

  // Rearranging a Tuesday must not reach any other day.
  it('leaves the other days untouched', () => {
    const two = insertEntry(week(), 4, 0, restEntry('thu', 15));
    expect(labels(two)).toEqual(['a', 'b', 'c']);
    expect(entriesOn(two, 4)).toHaveLength(1);
  });

  it('edits only the fields a kind actually has', () => {
    const task = taskEntry('t1', null);
    const wild = wildcardEntry(null, 45);
    let pattern = insertEntry(null, MON, 0, task);
    pattern = insertEntry(pattern, MON, 1, wild);

    const timed = editEntry(pattern, MON, task.id, { startTime: '07:15', minutes: 999 });
    const edited = entriesOn(timed, MON)[0]!;
    expect(edited).toEqual({ ...task, startTime: '07:15' });
    expect('minutes' in edited).toBe(false);

    const resized = editEntry(pattern, MON, wild.id, { minutes: 90, label: 'ignored' });
    expect(entriesOn(resized, MON)[1]).toEqual({ ...wild, minutes: 90 });
  });

  it('unpinning a time puts it back to following what is above it', () => {
    const task = taskEntry('t1', '07:15');
    const pattern = editEntry(insertEntry(null, MON, 0, task), MON, task.id, { startTime: null });
    expect(entriesOn(pattern, MON)[0]).toMatchObject({ startTime: null });
  });

  it('bumps the version on every edit so a stale echo cannot overwrite it', () => {
    const one = week();
    expect(insertEntry(one, MON, 0, a).version).toBeGreaterThan(one.version);
    expect(moveEntry(one, MON, 0, 2).version).toBeGreaterThan(one.version);
    expect(removeEntry(one, MON, a.id).version).toBeGreaterThan(one.version);
  });
});

describe('setWildcardTasks', () => {
  const DATE = '2026-08-10';

  it('records what went in, in order', () => {
    const log = setWildcardTasks(null, DATE, 'w1', ['t2', 't1']);
    expect(log.wildcards).toEqual({ w1: ['t2', 't1'] });
  });

  it('emptying one removes the key rather than storing an empty list', () => {
    const filled = setWildcardTasks(null, DATE, 'w1', ['t1']);
    expect(setWildcardTasks(filled, DATE, 'w1', []).wildcards).toEqual({});
  });

  // Re-adding a task must not bring back a tick that was never made today.
  it('drops the completion of a task taken back out', () => {
    let log = setWildcardTasks(null, DATE, 'w1', ['t1', 't2']);
    log = setEntryCleared(log, DATE, 'w1:t1', true, NOW);
    log = setEntryCleared(log, DATE, 'w1:t2', true, NOW);
    const trimmed = setWildcardTasks(log, DATE, 'w1', ['t2']);
    expect(trimmed.cleared).toEqual({ 'w1:t2': NOW });
  });

  it('leaves another wildcard on the same day alone', () => {
    const one = setWildcardTasks(null, DATE, 'w1', ['t1']);
    const two = setWildcardTasks(one, DATE, 'w2', ['t9']);
    expect(two.wildcards).toEqual({ w1: ['t1'], w2: ['t9'] });
  });
});

describe('labels on a task', () => {
  const plain = taskWith(null, null);

  it('adds one that is not there and removes one that is', () => {
    const on = toggleTaskLabel(plain, 'l1');
    expect(on.labelIds).toEqual(['l1']);
    expect(toggleTaskLabel(on, 'l1').labelIds).toEqual([]);
  });

  it('keeps the ones already on it', () => {
    const two = toggleTaskLabel(toggleTaskLabel(plain, 'l1'), 'l2');
    expect(two.labelIds).toEqual(['l1', 'l2']);
    expect(toggleTaskLabel(two, 'l1').labelIds).toEqual(['l2']);
  });

  // Tasks written before labels existed have no array at all.
  it('copes with a task that predates labels', () => {
    const old = { ...plain, labelIds: undefined } as unknown as Task;
    expect(toggleTaskLabel(old, 'l1').labelIds).toEqual(['l1']);
    expect(stripLabel(old, 'l1').labelIds).toEqual([]);
  });

  // Stripping runs over every task when a label is deleted, including the
  // ones that never carried it — a toggle would add it to all of them.
  it('strips without ever adding', () => {
    expect(stripLabel(plain, 'l1').labelIds).toEqual([]);
    expect(stripLabel(toggleTaskLabel(plain, 'l1'), 'l1').labelIds).toEqual([]);
  });

  it('bumps the version so a stale echo cannot overwrite it', () => {
    expect(toggleTaskLabel(plain, 'l1').version).toBeGreaterThan(plain.version);
    expect(stripLabel(plain, 'l1').version).toBeGreaterThan(plain.version);
  });
});
